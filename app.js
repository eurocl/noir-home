import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import session from "express-session";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcrypt";


import Product from "./models/Product.js";
import User from "./models/User.js";
import Cart from "./models/Cart.js";

import productsRoutes from "./routes/products.js";
import jwt from "jsonwebtoken";
import authMiddleware from "./middleware/auth.js";

dotenv.config();

const app = express();
/* Render / Reverse Proxy */
app.set("trust proxy", 1);

const PORT = process.env.PORT || 3000;

/* =========================
   MIDDLEWARES
========================= */

app.use(express.json());

app.use(express.urlencoded({
  extended: true,
}));

app.use(express.static("public"));

/* =========================
   SESSION
========================= */

app.use(session({

  secret:
    process.env.SESSION_SECRET ||
    "noirhome_secret",

  resave: false,

  saveUninitialized: false,

  cookie: {

    secure: false,

    httpOnly: true,

    maxAge:
      1000 * 60 * 60 * 24,

  },

}));

/* =========================
   SECURITY
========================= */

app.use(helmet());

const limiter = rateLimit({

  windowMs:
    15 * 60 * 1000,

  max: 100,

});

app.use(limiter);

/* =========================
   VIEW ENGINE
========================= */

app.set("view engine", "ejs");

/* =========================
   API ROUTES
========================= */

app.use(
  "/products",
  productsRoutes
);

/* =========================
   MONGO
========================= */

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {

    console.log(
      "✅ Mongo conectado"
    );

  })
  .catch((err) => {

    console.log(err);

  });



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
   PRODUCT DETAIL
========================= */

app.get(
  "/products/:id",
  async (req, res) => {

    try {

      const product =
        await Product.findById(
          req.params.id
        );

      if (!product) {

        return res.send(
          "Product not found"
        );

      }

      res.render(
        "pages/product",
        {

          product,

          userId:
            req.session.userId,

          userName:
            req.session.userName,

        }
      );

    } catch (err) {

      console.log(err);

      res.send(
        "Error loading product"
      );

    }

  }
);

/* =========================
   LOGIN PAGE
========================= */

app.get("/login", (req, res) => {

  res.render("pages/login");

});

/* =========================
   REGISTER PAGE
========================= */

app.get("/register", (req, res) => {

  res.render("pages/register");

});

/* =========================
   REGISTER
========================= */

app.post(
  "/register",
  async (req, res) => {

    try {

      const {
        name,
        email,
        password,
      } = req.body;

      if (
        !name ||
        !email ||
        !password
      ) {

        return res.send(
          "All fields required"
        );

      }

      const existingUser =
        await User.findOne({
          email,
        });

      if (existingUser) {

        return res.send(
          "Email already exists"
        );

      }

      const passwordRegex =
        /^(?=.*[0-9])(?=.*[!@#$%^&*]).{6,}$/;

      if (
        !passwordRegex.test(
          password
        )
      ) {

        return res.send(
          "Password must contain 6 characters, one number and one special character"
        );

      }

      const hashedPassword =
        await bcrypt.hash(
          password,
          10
        );

      const newUser =
        new User({

          name,

          email,

          password:
            hashedPassword,

        });

      await newUser.save();

      res.redirect("/login");

    } catch (err) {

      console.log(err);

      res.send(
        "Register error"
      );

    }

  }
);

/* =========================
   LOGIN
========================= */

app.post("/login", async (req, res) => {

  try {

    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {

      return res.status(401).json({
        message: "User not found"
      });

    }

    const validPassword =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!validPassword) {

      return res.status(401).json({
        message: "Invalid password"
      });

    }

    const token = jwt.sign(

      {
        userId: user._id,
        email: user.email
      },

      process.env.JWT_SECRET,

      {
        expiresIn: "1h"
      }

    );

    // Mantener sesión
req.session.userId = user._id;
req.session.userName = user.name;

    res.status(200).json({
      token
    });

  } catch (err) {

    res.status(500).json({
      message: "Login error"
    });

  }

});

/* =========================
   ADD TO CART
========================= */

app.post(
  "/cart/add/:id",
  async (req, res) => {

    try {

      if (
        !req.session.userId
      ) {

        return res.redirect(
          "/login"
        );

      }

      const userId =
        req.session.userId;

      const productId =
        req.params.id;

      let cart =
        await Cart.findOne({
          userId,
        });

      if (!cart) {

        cart = new Cart({

          userId,

          products: [],

        });

      }

      const existingProduct =
        cart.products.find(
          item =>
            item.productId.toString() ===
            productId
        );

      if (
        existingProduct
      ) {

        existingProduct.quantity += 1;

      } else {

        cart.products.push({

          productId,

          quantity: 1,

        });

      }

      await cart.save();

      res.redirect("/cart");

    } catch (err) {

      console.log(err);

      res.send(
        "Cart error"
      );

    }

  }
);

/* =========================
   CART PAGE
========================= */

app.get(
  "/cart",
  async (req, res) => {

    try {

      if (
        !req.session.userId
      ) {

        return res.redirect(
          "/login"
        );

      }

      const cart =
        await Cart.findOne({

          userId:
            req.session.userId,

        }).populate(
          "products.productId"
        );

      res.render(
        "pages/cart",
        {

          cart,

          userName:
            req.session.userName,

        }
      );

    } catch (err) {

      console.log(err);

      res.send(
        "Cart error"
      );

    }

  }
);

// SUMAR CANTIDAD

app.post("/cart/increase/:id", async (req, res) => {

  const cart = await Cart.findOne({
    userId: req.session.userId
  });

  if (!cart) {
    return res.redirect("/cart");
  }

  const product = cart.products.find(p =>
    p.productId.toString() === req.params.id
  );

  if (product) {
    product.quantity += 1;
  }

  await cart.save();

  res.redirect("/cart");

});


// RESTAR CANTIDAD

app.post("/cart/decrease/:id", async (req, res) => {

  const cart = await Cart.findOne({
    userId: req.session.userId
  });

  if (!cart) {
    return res.redirect("/cart");
  }

  const product = cart.products.find(p =>
    p.productId.toString() === req.params.id
  );

  if (product) {

    if (product.quantity > 1) {

      product.quantity -= 1;

    } else {

      cart.products = cart.products.filter(p =>
        p.productId.toString() !== req.params.id
      );

    }

  }

  await cart.save();

  res.redirect("/cart");

});


// ELIMINAR PRODUCTO

app.post("/cart/remove/:id", async (req, res) => {

  const cart = await Cart.findOne({
    userId: req.session.userId
  });

  if (!cart) {
    return res.redirect("/cart");
  }

  cart.products = cart.products.filter(p =>
    p.productId.toString() !== req.params.id
  );

  await cart.save();

  res.redirect("/cart");

});

/* =========================
   LOGOUT
========================= */

app.get(
  "/logout",
  (req, res) => {

    req.session.destroy(() => {

      res.redirect("/");

    });

  }
);

/* =========================
   about
========================= */


app.get("/about", (req, res) => {

  res.render("pages/about", {

    userId:
      req.session.userId,

    userName:
      req.session.userName,

  });

});

/* =========================
   CATALOG
========================= */

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

app.listen(PORT, () => {

  console.log(
    `🚀 Server running on port ${PORT}`
  );

});