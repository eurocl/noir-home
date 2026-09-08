import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import session from "express-session";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "node:url";
import dns from "node:dns";

import Product from "./models/Product.js";
import User from "./models/User.js";
import Cart from "./models/Cart.js";

import productsRoutes from "./routes/products.js";

dotenv.config({ path: fileURLToPath(new URL(".env", import.meta.url)) });

const app = express();

app.set("trust proxy", 1);
const PORT = process.env.PORT || 3000;

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
      secure: false,
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

/* =========================
   SECURITY
========================= */
app.use(helmet());

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

/* =========================
   MONGO
========================= */

/* =========================
   HOME
========================= */
app.get("/", async (req, res) => {
  try {
    const products = await Product.find();

    res.render("pages/home", {
      products,
      userId: req.session.userId,
      userName: req.session.userName,
    });
  } catch (err) {
    console.log(err);
    res.send("Error loading products");
  }
});

/* =========================
   LOGIN / REGISTER
========================= */
app.get("/login", (req, res) => res.render("pages/login"));
app.get("/register", (req, res) => res.render("pages/register"));

app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.send("Completá todos los campos");
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.send("Ya existe una cuenta con ese correo electrónico");
    }

    const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*]).{6,}$/;

    if (!passwordRegex.test(password)) {
      return res.send(
        "La contraseña debe tener al menos 6 caracteres, un número y un carácter especial (!@#$%^&*)"
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
    });

    await newUser.save();

    res.redirect("/login");
  } catch (err) {
    console.log(err);
    res.send("No se pudo crear la cuenta. Intentá nuevamente.");
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: "Usuario no encontrado" });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ message: "Contraseña incorrecta" });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    req.session.userId = user._id;
    req.session.userName = user.name;

    res.status(200).json({ token });
  } catch (err) {
    res.status(500).json({ message: "No se pudo iniciar sesión. Intentá nuevamente." });
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

    const cart = await Cart.findOne({
      userId: req.session.userId,
    }).populate("products.productId");

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

app.get("/catalog", (req, res) => {
  res.render("pages/catalog", {
    userId: req.session.userId,
    userName: req.session.userName,
  });
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
try {
  if (!process.env.MONGO_URI) throw new Error("Falta MONGO_URI en .env");
  if (!process.env.JWT_SECRET) throw new Error("Falta JWT_SECRET en .env");
  if (process.env.MONGO_DNS_SERVERS) {
    dns.setServers(process.env.MONGO_DNS_SERVERS.split(",").map((server) => server.trim()));
  }
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  console.log("✅ Mongo conectado");
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
} catch (err) {
  const message = err.message.replace(/mongodb(?:\+srv)?:\/\/[^\s]+/g, "[URI oculta]");
  console.error(`No se pudo iniciar el servidor: ${message}`);
  await mongoose.disconnect();
  process.exitCode = 1;
}
