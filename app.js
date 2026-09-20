import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import session from "express-session";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { fileURLToPath, pathToFileURL } from "node:url";
import dns from "node:dns";
import contentConnection from "./config/content-database.js";

import Cart from "./models/Cart.js";
import Person from "./models/Person.js";
import Architecture from "./models/Architecture.js";

import productsRoutes from "./routes/product-gateway.js";
import { requestService } from "./services/client.js";
import { listenOptions, validateServiceUrls } from "./services/deployment.js";
import peopleRoutes from "./routes/people.js";
import architectureRoutes from "./routes/architecture.js";

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
app.use(
  session({
    secret: process.env.SESSION_SECRET || "noirhome_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.RENDER === "true",
      sameSite: "lax",
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

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
    max: 100,
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
app.use("/products", productsRoutes);
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
    const architectureItems = await loadContent(Architecture);

    res.render("pages/catalog", {
      architectureItems,
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

    const products = await requestService("products", "/products");

    const people = await loadContent(Person);

    res.render("pages/home", {
      products,
      people,
      userId: req.session.userId,
      userName: req.session.userName,
    });

  } catch (err) {

    console.log(err);

    res.status(500).send("No se pudo cargar el bazar. Intentá nuevamente.");

  }
});

/* =========================
   LOGIN / REGISTER
========================= */
app.get("/login", (req, res) => res.render("pages/login"));
app.get("/register", (req, res) => res.render("pages/register"));

app.post("/register", async (req, res) => {
  try {
    await requestService("users", "/users/register", { method: "POST", body: req.body });
    res.redirect("/login");
  } catch (error) {
    res.status(error.status || 500).type("text").send(error.message);
  }
});

app.post("/login", async (req, res) => {
  try {
    const { token, user } = await requestService("users", "/users/login", { method: "POST", body: req.body });
    await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
    req.session.userId = user.id;
    req.session.userName = user.name;
    await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
    res.json({ token });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.status ? error.message : "No se pudo iniciar sesión" });
  }
});

/* =========================
   CART
========================= */
app.post("/cart/add/:id", async (req, res) => {
  try {
    if (!req.session.userId) return res.redirect("/login");

    const userId = req.session.userId;
    const productId = req.params.id;

    await requestService("products", `/products/${encodeURIComponent(productId)}`);
    let cart = await Cart.findOne({ userId });

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
    res.send("Cart error");
  }
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
          const product = await requestService("products", `/products/${encodeURIComponent(item.productId)}`);
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
    res.status(500).send("Cart error");
  }
});

/* =========================
   LOGOUT
========================= */
app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
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
    const architectureItems = await loadContent(Architecture);

    res.render("pages/catalog", {
      architectureItems,
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
  if (process.env.RENDER === "true" && !process.env.SESSION_SECRET) throw new Error("Falta SESSION_SECRET");
  validateServiceUrls(["users", "products", "stock"]);
  const listener = listenOptions(PORT);
  if (process.env.MONGO_DNS_SERVERS) {
    dns.setServers(process.env.MONGO_DNS_SERVERS.split(",").map((server) => server.trim()));
  }
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  if (process.env.MONGO_CONTENT_URI && process.env.CONTENT_ENABLED !== "false") {
    contentConnection.openUri(process.env.MONGO_CONTENT_URI, { serverSelectionTimeoutMS: 10000 })
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
