import { timingSafeEqual } from 'node:crypto';

export function internalAuth(req, res, next) {
  const expected = process.env.INTERNAL_SERVICE_SECRET;
  const supplied = req.headers['x-service-key'];
  if (!expected || typeof supplied !== 'string') return res.status(401).json({ message: 'Acceso interno requerido' });
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return res.status(401).json({ message: 'Acceso interno requerido' });
  next();
}
