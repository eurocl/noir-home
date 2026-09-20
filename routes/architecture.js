import express from "express";
import Architecture from "../models/Architecture.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const architecture = await Architecture.find();


    res.json(architecture);

  } catch (err) {
    console.log("ERROR ARCHITECTURE:", err);
    res.status(500).json({
      message: "Error loading architecture",
    });
  }
});

export default router;