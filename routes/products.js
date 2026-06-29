import express from "express";
import Product from "../models/Product.js";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();

/* =========================
   GET ALL PRODUCTS (API)
========================= */
router.get("/", async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Error loading products",
    });
  }
});

/* =========================
   GET PRODUCT DETAIL (FRONTEND - EJS)
   👉 ESTE ES EL QUE TE FALTABA
========================= */
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.send("Product not found");
    }

    res.render("pages/product", {
      product,
      userId: req.session?.userId,
      userName: req.session?.userName,
    });

  } catch (err) {
    console.log(err);

    if (err.name === "CastError") {
      return res.send("Product not found");
    }

    res.send("Error loading product");
  }
});

/* =========================
   CREATE PRODUCT (API)
========================= */
router.post("/", authMiddleware, async (req, res) => {
  try {
    const {
      name,
      category,
      description,
      price,
      image,
      stock,
    } = req.body;

    const newProduct = new Product({
      name,
      category,
      description,
      price,
      image,
      stock,
    });

    await newProduct.save();

    res.status(201).json({
      message: "Product created",
      product: newProduct,
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Error creating product",
    });
  }
});

/* =========================
   DELETE PRODUCT (API)
========================= */
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);

    res.json({
      message: "Product deleted",
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({
      error: err.message,
    });
  }
});

export default router;