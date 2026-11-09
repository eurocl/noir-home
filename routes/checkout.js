import express from 'express';
import mongoose from 'mongoose';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import Cart from '../models/Cart.js';
import Order from '../models/Order.js';
import { requestService } from '../services/client.js';

const router = express.Router();
const money = cents => (cents / 100).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
const problem = (status, message) => Object.assign(new Error(message), { status });
router.use((req, res, next) => {
  if (!/^\/(checkout|orders)(\/|$)/.test(req.path)) return next('router');
  if (!req.session.userId) return res.redirect('/login');
  res.set('Cache-Control', 'no-store');
  req.session.checkoutCsrf ||= randomBytes(32).toString('hex');
  res.locals.userId = req.session.userId;
  res.locals.userName = req.session.userName;
  res.locals.money = money;
  res.locals.checkoutCsrf = req.session.checkoutCsrf;
  next();
});
router.use((req, res, next) => {
  if (req.method === 'GET') return next();
  const supplied = Buffer.from(typeof req.body?._csrf === 'string' ? req.body._csrf : '');
  const expected = Buffer.from(req.session.checkoutCsrf);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return res.status(403).send('El formulario venció. Volvé a abrir el resumen de compra.');
  next();
});
const showError = (res, error) => res.status(error.status || 503).render('pages/checkout-error', {
  message: error.status ? error.message : 'No se pudo completar la consulta. Tu carrito sigue guardado. Revisá Mis pedidos antes de volver a confirmar.',
});

async function finishOrder(order, receipt) {
  if (!['confirmed', 'rejected'].includes(receipt.status) || String(receipt._id) !== String(order._id)) throw new Error('Respuesta de inventario inválida');
  await mongoose.connection.transaction(async session => {
    const current = await Order.findById(order._id).session(session);
    if (!current || current.status !== 'pending') return;
    current.status = receipt.status;
    current.reason = receipt.reason;
    if (receipt.status === 'confirmed') current.confirmedAt = new Date();
    await current.save({ session });
    await Cart.updateOne({ _id: current.cartId, userId: current.userId, checkoutOrderId: current._id }, {
      $set: { checkoutOrderId: null, ...(receipt.status === 'confirmed' ? { products: [] } : {}) },
      $inc: { __v: 1 },
    }, { session });
  });
}

async function processOrder(order) {
  if (order.status !== 'pending') return;
  const receipt = await requestService('stock', `/internal/purchases/${order._id}`, {
    method: 'PUT', internal: true, timeoutMs: 10000,
    body: { items: order.items.map(item => ({ productId: String(item.productId), quantity: item.quantity })) },
  });
  await finishOrder(order, receipt);
}

router.get('/checkout', async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.session.userId }).lean();
    if (cart?.checkoutOrderId) return res.redirect(`/orders/${cart.checkoutOrderId}`);
    if (!cart?.products.length) return res.redirect('/cart');
    if (cart.products.length > 100) throw problem(400, 'El carrito admite hasta 100 productos diferentes.');
    const catalog = await requestService('products', '/products', { timeoutMs: 8000 });
    const productsById = new Map(catalog.map(product => [String(product._id), product]));
    const items = [];
    for (const item of cart.products) {
      const product = productsById.get(String(item.productId));
      if (!product) throw problem(409, 'Un producto ya no está disponible. Revisá tu carrito.');
      const unitPriceCents = Math.round(Number(product.price) * 100);
      if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || !Number.isSafeInteger(unitPriceCents) || unitPriceCents < 0) throw problem(409, 'Revisá los precios y cantidades de tu carrito.');
      items.push({ productId: String(item.productId), name: product.name, quantity: item.quantity, unitPriceCents });
    }
    const totalCents = items.reduce((total, item) => total + item.quantity * item.unitPriceCents, 0);
    if (!Number.isSafeInteger(totalCents)) throw problem(400, 'El importe del carrito supera el máximo permitido.');
    const quote = { orderId: String(new mongoose.Types.ObjectId()), cartId: String(cart._id), version: cart.__v,
      items, totalCents, expiresAt: Date.now() + 20 * 60 * 1000 };
    req.session.checkoutQuote = quote;
    res.render('pages/checkout', { quote });
  } catch (error) { showError(res, error); }
});

router.post('/checkout', async (req, res) => {
  let order;
  try {
    if (!mongoose.isObjectIdOrHexString(req.body.orderId)) throw problem(400, 'Pedido inválido.');
    order = await Order.findOne({ _id: req.body.orderId, userId: req.session.userId });
    if (!order) {
      const quote = req.session.checkoutQuote;
      if (!quote || quote.orderId !== req.body.orderId || quote.expiresAt < Date.now()) throw problem(409, 'El resumen venció. Volvé al carrito para revisar la compra.');
      try {
        await mongoose.connection.transaction(async session => {
          order = await Order.findOne({ _id: quote.orderId, userId: req.session.userId }).session(session);
          if (order) return;
          const cart = await Cart.findOne({ _id: quote.cartId, userId: req.session.userId }).session(session);
          if (cart?.checkoutOrderId) {
            order = await Order.findOne({ _id: cart.checkoutOrderId, userId: req.session.userId }).session(session);
            if (order) return;
          }
          if (!cart || cart.__v !== quote.version || !cart.products.length) throw problem(409, 'El carrito cambió. Volvé a revisar el resumen antes de confirmar.');
          [order] = await Order.create([{ _id: quote.orderId, userId: req.session.userId, cartId: cart._id,
            items: quote.items, totalCents: quote.totalCents, status: 'pending', demo: true }], { session });
          cart.checkoutOrderId = order._id;
          await cart.save({ session });
        });
      } catch (error) {
        order = await Order.findOne({ _id: quote.orderId, userId: req.session.userId });
        if (!order) throw error;
      }
    }
    try { await processOrder(order); } catch { /* Keep the durable pending order for safe recovery. */ }
    res.redirect(303, `/orders/${order._id}`);
  } catch (error) { showError(res, error); }
});

router.get('/orders', async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.session.userId }).sort({ createdAt: -1 }).limit(50).lean();
    res.render('pages/orders', { orders });
  } catch (error) { showError(res, error); }
});
router.get('/orders/:id', async (req, res) => {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) throw problem(404, 'Pedido no encontrado.');
    let order = await Order.findOne({ _id: req.params.id, userId: req.session.userId }).lean();
    if (!order) throw problem(404, 'Pedido no encontrado.');
    if (order.status === 'pending') {
      try {
        const receipt = await requestService('stock', `/internal/purchases/${order._id}`, { internal: true, timeoutMs: 3000 });
        await finishOrder(order, receipt);
        order = await Order.findById(order._id).lean();
      } catch { /* Never display a payment or stock confirmation without its receipt. */ }
    }
    res.render('pages/order', { order });
  } catch (error) { showError(res, error); }
});
router.post('/orders/:id/retry', async (req, res) => {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) throw problem(404, 'Pedido no encontrado.');
    const order = await Order.findOne({ _id: req.params.id, userId: req.session.userId });
    if (!order) throw problem(404, 'Pedido no encontrado.');
    try { await processOrder(order); } catch { /* The same order ID is safe to retry later. */ }
    res.redirect(303, `/orders/${order._id}`);
  } catch (error) { showError(res, error); }
});
export default router;
