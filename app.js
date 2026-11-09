import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { persistentSession } from "./config/session.js";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { fileURLToPath, pathToFileURL } from "node:url";
import dns from "node:dns";
import contentConnection from "./config/content-database.js";

import Cart from "./models/Cart.js";
import Person from "./models/Person.js";
import { loadArchitecture } from "./services/architecture.js";

import productsRoutes from "./routes/product-gateway.js";
import { requestService } from "./services/client.js";
import { findRecentProduct, getLastCatalog, rememberCatalog } from "./services/catalog-cache.js";
import { listenOptions, validateServiceUrls } from "./services/deployment.js";
import peopleRoutes from "./routes/people.js";
import architectureRoutes from "./routes/architecture.js";
import adminRoutes from "./routes/admin.js";
import checkoutRoutes from './routes/checkout.js';

dotenv.config({ path: fileURLToPath(new URL(".env", import.meta.url)) });

const app = express();

async function loadContent(model) {
  if (contentConnection.readyState !== 1) return [];
  try { return await model.find(); }
  catch { return []; }
}
app.use((req, res, next) => {
  res.locals.contentUnavailable = contentConnection.readyState !== 1;
  next();
});

app.set("trust proxy", 1);
const PORT = process.env.PORT || 3000;
app.get("/health", (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ service: "web", ready });
});

/* =========================
   MIDDLEWARES
========================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(fileURLToPath(new URL("public", import.meta.url))));

/* =========================
   SESSION
========================= */
app.use(persistentSession);

/* =========================
   SECURITY
========================= */
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),

        "img-src": [
          "'self'",
          "data:",
          "https:"
        ],
      },
    },
  })
);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  })
);

/* =========================
   VIEW ENGINE
========================= */
app.set("view engine", "ejs");
app.set("views", fileURLToPath(new URL("views", import.meta.url)));

/* =========================
   ROUTES
========================= */
app.use((req, res, next) => {
  res.locals.isAdmin = req.session.userRole === "admin";
  next();
});
app.use("/products", productsRoutes);
app.use("/admin", adminRoutes);
app.use(checkoutRoutes);
app.use("/people", peopleRoutes);
app.use("/architecture", architectureRoutes);
app.get("/stock", async (req, res) => {
  try { res.json(await requestService("stock", "/stock")); }
  catch (error) { res.status(error.status || 500).json({ message: error.message }); }
});

/* =========================
   MONGO
========================= */

/* =========================
   HOME
========================= */
app.get("/", async (req, res) => {
  try {
    const architecture = await loadArchitecture();

    res.render("pages/catalog", {
      ...architecture,
      userId: req.session.userId,
      userName: req.session.userName,
    });
  } catch (err) {
    console.log(err);
    res.status(500).send("No se pudo cargar la arquitectura. Intentá nuevamente.");
  }
});

app.get("/bazar", async (req, res) => {
  try {

    let catalogDelayed = false;
    let products;
    try {
      products = await requestService("products", "/products", { timeoutMs: 3500 });
      rememberCatalog(products);
    } catch (error) {
      products = getLastCatalog();
      if (!products || ![429, 502, 503, 504].includes(error.status)) throw error;
      catalogDelayed = true;
    }

    const people = await loadContent(Person);

    res.render("pages/home", {
      products,
      catalogDelayed,
      people,
      userId: req.session.userId,
      userName: req.session.userName,
    });

  } catch (err) {

    console.log(err);

    if ([429, 502, 503, 504].includes(err.status)) {
      return res.status(503).set("Retry-After", "10").send('El catálogo está tardando en responder. <a href="/bazar">Volver a intentar</a>');
    }
    res.status(500).send("No se pudo cargar el bazar. Intentá nuevamente.");

  }
});

/* =========================
   LOGIN / REGISTER
========================= */
let usersWarmup;
let lastUsersWarmup = 0;

app.get("/login", (req, res) => {
  if (process.env.RENDER === 'true' && !usersWarmup && Date.now() - lastUsersWarmup > 60_000) {
    lastUsersWarmup = Date.now();
    usersWarmup = requestService("users", "/health", { timeoutMs: 30000 })
      .catch(() => {})
      .finally(() => { usersWarmup = undefined; });
  }
  res.render("pages/login");
});
app.get("/register", (req, res) => res.render("pages/register"));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Demasiados intentos de acceso. Esperá unos minutos antes de volver a intentar.' },
});

app.post("/register", async (req, res) => {
  try {
    await requestService("users", "/users/register", { method: "POST", body: req.body });
    res.redirect("/login");
  } catch (error) {
    res.status(error.status || 500).type("text").send(error.message);
  }
});

app.post("/login", loginLimiter, async (req, res) => {
  try {
    const { token, user } = await requestService("users", "/users/login", { method: "POST", body: req.body });
    await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
    req.session.userId = user.id;
    req.session.userName = user.name;
    req.session.userRole = user.role;
    req.session.accessToken = token;
    await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
    res.json({ token });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.status ? error.message : "No se pudo iniciar sesión" });
  }
});

/* =========================
   CART
========================= */
async function cartProduct(id) {
  return findRecentProduct(String(id)) ?? requestService("products", `/products/${encodeURIComponent(id)}`, { timeoutMs: 8000 });
}

app.post("/cart/add/:id", async (req, res) => {
  try {
    if (!req.session.userId) return res.redirect("/login");

    const userId = req.session.userId;
    const productId = req.params.id;

    if (!mongoose.isObjectIdOrHexString(productId)) return res.status(400).send("Producto inválido");
    let cart = await Cart.findOne({ userId });

    if (cart?.checkoutOrderId) return res.redirect(303, `/orders/${cart.checkoutOrderId}`);
    await cartProduct(productId);

    if (!cart) {
      cart = new Cart({ userId, products: [] });
    }

    const existingProduct = cart.products.find(
      (item) => item.productId.toString() === productId
    );

    if (existingProduct) {
      existingProduct.quantity += 1;
    } else {
      cart.products.push({ productId, quantity: 1 });
    }

    await cart.save();

    res.redirect("/cart");
  } catch (err) {
    console.log(err);
    if (err.name === 'VersionError') return res.status(409).send("El carrito cambió. Volvé a consultarlo antes de agregar el producto.");
    res.status(err.status || 500).send("No se pudo agregar el producto. Volvé a la ficha para intentar de nuevo.");
  }
});

app.post('/cart/:action/:id', async (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const { action, id } = req.params;
  if (!['increase', 'decrease', 'remove'].includes(action)) return res.sendStatus(404);
  if (!mongoose.isObjectIdOrHexString(id)) return res.status(400).send('Producto inválido');
  try {
    const cart = await Cart.findOne({ userId: req.session.userId });
    if (cart?.checkoutOrderId) return res.redirect(303, `/orders/${cart.checkoutOrderId}`);
    const item = cart?.products.find(product => String(product.productId) === id);
    if (!item) return res.status(404).send('El producto no está en tu carrito');
    if (action === 'increase') {
      await cartProduct(id);
      item.quantity += 1;
    } else if (action === 'remove' || item.quantity <= 1) {
      cart.products = cart.products.filter(product => String(product.productId) !== id);
    } else { item.quantity -= 1; }
    await cart.save();
    res.redirect(303, '/cart');
  } catch (error) { res.status(error.name === 'VersionError' ? 409 : error.status || 500).send('No se pudo actualizar el carrito. Volvé a consultarlo antes de intentar nuevamente.'); }
});

app.get("/cart", async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.redirect("/login");
    }

    const savedCart = await Cart.findOne({ userId: req.session.userId }).lean();
    const cart = savedCart ? {
      ...savedCart,
      products: await Promise.all(savedCart.products.map(async item => {
        try {
          const product = await cartProduct(item.productId);
          return { ...item, productId: product };
        } catch (error) {
          if (error.status === 404) return { ...item, productId: null };
          throw error;
        }
      })),
    } : null;

    res.render("pages/cart", {
      cart: cart || { products: [] },
      userName: req.session.userName,
    });

  } catch (err) {
    console.log("CART ERROR:", err);
    res.status(err.status || 500).send("No se pudo consultar el carrito. Intentá nuevamente.");
  }
});

/* =========================
   LOGOUT
========================= */
app.get("/logout", (req, res) => {
  req.session.destroy(error => {
    if (error) return res.status(503).send('No se pudo cerrar la sesión. Intentá nuevamente.');
    res.clearCookie('connect.sid', { path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.RENDER === 'true' });
    res.redirect('/');
  });
});

/* =========================
   ABOUT / CATALOG
========================= */
app.get("/about", (req, res) => {
  res.render("pages/about", {
    userId: req.session.userId,
    userName: req.session.userName,
  });
});

app.get("/catalog", async (req, res) => {
  try {
    const architecture = await loadArchitecture();

    res.render("pages/catalog", {
      ...architecture,
      userId: req.session.userId,
      userName: req.session.userName,
    });
  } catch (err) {
    console.log(err);
    res.status(500).send("No se pudo cargar la arquitectura. Intentá nuevamente.");
  }
});

/* =========================
   404
========================= */
app.use((req, res) => {
  res.status(404).render("pages/404");
});

/* =========================
   SERVER
========================= */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
try {
  if (!process.env.MONGO_URI) throw new Error("Falta MONGO_URI en .env");
  if (!process.env.JWT_SECRET) throw new Error("Falta JWT_SECRET en .env");
  if (!process.env.SESSION_SECRET) throw new Error("Falta SESSION_SECRET");
  validateServiceUrls(["users", "products", "stock"]);
  const listener = listenOptions(PORT);
  if (process.env.MONGO_DNS_SERVERS) {
    dns.setServers(process.env.MONGO_DNS_SERVERS.split(",").map((server) => server.trim()));
  }
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  await Promise.all(Object.values(mongoose.models).map(model => model.init()));
  if (process.env.MONGO_CONTENT_URI && process.env.CONTENT_ENABLED !== "false") {
    await contentConnection.openUri(process.env.MONGO_CONTENT_URI, { dbName: "Hijos", serverSelectionTimeoutMS: 10000 })
      .then(() => console.log("Mongo de contenido conectado"))
      .catch(() => console.warn("Contenido externo no disponible; usuarios y productos siguen independientes."));
  }
  console.log("Mongo del carrito conectado");
  app.listen(listener.port, listener.host, () => {
    console.log(`🚀 Server running on ${listener.host}:${listener.port}`);
  });
} catch (err) {
  const message = err.message.replace(/mongodb(?:\+srv)?:\/\/[^\s]+/g, "[URI oculta]");
  console.error(`No se pudo iniciar el servidor: ${message}`);
  await mongoose.disconnect();
  process.exitCode = 1;
}
}

export default app;
