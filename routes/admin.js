import express from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { requestService } from '../services/client.js';

const router = express.Router();
router.use(async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (!req.session.userId || !req.session.accessToken) return res.redirect('/login');
  try {
    const user = await requestService('users', '/users/me', { token: req.session.accessToken });
    req.session.userRole = user.role;
    res.locals.isAdmin = user.role === 'admin';
    if (!res.locals.isAdmin) return res.status(403).send('No tenés permisos para acceder a la administración.');
    req.session.adminCsrf ||= randomBytes(32).toString('hex');
    next();
  } catch (error) {
    if ([401, 404].includes(error.status)) return req.session.destroy(() => res.redirect('/login'));
    res.status(503).send('No se pudo verificar tu permiso. Intentá nuevamente en unos momentos.');
  }
});
router.use((req, res, next) => {
  if (req.method === 'GET') return next();
  const submitted = Buffer.from(typeof req.body?._csrf === 'string' ? req.body._csrf : '');
  const expected = Buffer.from(req.session.adminCsrf);
  if (submitted.length !== expected.length || !timingSafeEqual(submitted, expected)) {
    return res.status(403).send('El formulario venció. Volvé a abrir Administración e intentá nuevamente.');
  }
  next();
});
router.get('/', async (req, res) => {
  try {
    const products = await requestService('products', '/products');
    let inventory = [], stockUnavailable = false;
    try { inventory = await requestService('stock', '/stock'); } catch { stockUnavailable = true; }
    const notice = req.session.adminNotice;
    delete req.session.adminNotice;
    res.render('pages/admin', {
      products, inventory, stockUnavailable, notice,
      csrf: req.session.adminCsrf, userId: req.session.userId, userName: req.session.userName,
    });
  } catch { res.status(503).send('No se pudo cargar el catálogo. Volvé a intentar en unos momentos.'); }
});
router.post('/products', async (req, res) => {
  const { name, category, description, price, image, stock } = req.body;
  const localImage = typeof image === 'string' && /^\/images\/[a-zA-Z0-9_./% -]+$/.test(image) && !image.includes('..');
  if (!localImage || !String(price ?? '').trim() || !String(stock ?? '').trim()) {
    req.session.adminNotice = 'Completá precio y stock. Usá una imagen de /images/ que ya exista en el proyecto.';
    return res.redirect(303, '/admin');
  }
  try {
    await requestService('products', '/products', {
      method: 'POST', token: req.session.accessToken,
      body: { name, category, description, image, price: Number(price), stock: Number(stock) },
    });
    req.session.adminNotice = 'Producto creado. Ya podés verlo en el bazar.';
  } catch (error) {
    req.session.adminNotice = `${error.message}. Revisá el listado antes de volver a intentarlo.`;
  }
  res.redirect(303, '/admin');
});
router.post('/products/:id/delete', async (req, res) => {
  if (req.body.confirm !== req.params.id) return res.status(400).send('Confirmá qué producto querés eliminar.');
  try {
    await requestService('products', `/products/${encodeURIComponent(req.params.id)}`, { method: 'DELETE', token: req.session.accessToken });
    req.session.adminNotice = 'Producto eliminado del catálogo y del inventario.';
  } catch (error) {
    req.session.adminNotice = `${error.message}. Revisá el listado antes de volver a intentarlo.`;
  }
  res.redirect(303, '/admin');
});
export default router;
