import mongoose from "mongoose";
import contentConnection from "../config/content-database.js";

const personSchema = new mongoose.Schema({
  nombre: String,
  role: String,
  imagen: String,
  comentario: String,
});

const Person = contentConnection.model(
  "Person",
  personSchema,
  "Personas"
);

export default Person;
