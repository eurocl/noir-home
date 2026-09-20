import express from "express";
import Person from "../models/Person.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const people = await Person.find();


    res.json(people);
  } catch (err) {
    console.log("ERROR PEOPLE:", err);

    res.status(500).json({
      message: "Error loading people",
    });
  }
});

export default router;