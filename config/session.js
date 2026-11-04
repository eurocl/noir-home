import session from 'express-session';
import MongoStore from 'connect-mongo';
import mongoose from 'mongoose';

let middleware;
export function persistentSession(req, res, next) {
  if (mongoose.connection.readyState !== 1) return res.status(503).send('No se pudo consultar la sesión. Intentá nuevamente.');
  if (!middleware) {
    const store = MongoStore.create({
      client: mongoose.connection.getClient(),
      dbName: mongoose.connection.name,
      collectionName: process.env.RENDER === 'true' ? 'sessions' : 'sessions_local',
      ttl: 24 * 60 * 60,
      autoRemove: 'native',
    });
    store.on('error', () => console.error('No se pudo acceder al almacenamiento de sesiones'));
    middleware = session({
      secret: process.env.SESSION_SECRET,
      store,
      resave: false,
      saveUninitialized: false,
      cookie: { secure: process.env.RENDER === 'true', httpOnly: true, sameSite: 'lax', maxAge: 86400000 },
    });
  }
  middleware(req, res, error => {
    if (error) return res.status(503).send('No se pudo recuperar la sesión. Intentá nuevamente.');
    next();
  });
}
