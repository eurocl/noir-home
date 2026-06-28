import express from "express";
import Product from "../models/Product.js";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();

/* GET PRODUCTS */

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


/* GET PRODUCT BY ID */



router.get("/:id", async (req, res) => {

  try {

    const product = await Product.findById(
      req.params.id
    );

    if (!product) {

      return res.status(404).json({
        message: "Product not found"
      });

    }

    res.status(200).json(product);

  } catch (err) {

    console.log(err);

    if (err.name === "CastError") {

      return res.status(404).json({
        message: "Product not found"
      });

    }

    res.status(500).json({
      message: "Error loading product"
    });

  }

});

/* CREATE PRODUCT */

router.post(
  "/",
  authMiddleware,
  async (req, res) => {

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

/* DELETE PRODUCT */

router.delete("/:id", authMiddleware, async (req, res) => {

  try {

    await Product.findByIdAndDelete(
      req.params.id
    );

    res.json({
      message: "Product deleted"
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      error: err.message
    });

  }

});

export default router;