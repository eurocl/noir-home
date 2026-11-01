import express from "express";
import Architecture from "../models/Architecture.js";
import contentConnection from "../config/content-database.js";

const router = express.Router();

router.get("/", async (req, res) => {
  if (contentConnection.readyState !== 1) return res.status(503).json({ message: "La base de arquitectura no está disponible" });
  try {
    const architecture = await Architecture.find({}, { _id: 0, __v: 0 }).sort({ number: 1 }).lean();


    res.json(architecture);

  } catch (err) {
    console.log("ERROR ARCHITECTURE:", err);
    res.status(500).json({
      message: "Error loading architecture",
    });
  }
});

export default router;
