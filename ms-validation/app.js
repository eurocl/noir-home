import express from "express";
import dotenv from "dotenv";
import authMiddleware from "./middleware/auth.js";

dotenv.config();

const app = express();

app.get(
  "/profile",
  authMiddleware,
  (req, res) => {

    res.status(200).json({

      message: "Token valid",

      user: req.user

    });

  }
);

app.get("/", (req, res) => {
  res.send("MS Validation funcionando");
});

app.get("/validate", authMiddleware, (req, res) => {

  res.status(200).json({
    valid: true,
    user: req.user
  });

});

app.listen(
  process.env.PORT,
  () => {

    console.log(
      `Validation service running on ${process.env.PORT}`
    );

  }
);