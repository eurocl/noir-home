import mongoose from "mongoose";
import contentConnection from "../config/content-database.js";

const architectureSchema = new mongoose.Schema({
  título: String,
  estilo: String,
  imagen: String,
  descripción: String,
});

const Architecture = contentConnection.model(
  "Architecture",
  architectureSchema,
  "Arquitectura"
);

export default Architecture;
