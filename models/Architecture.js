import mongoose from "mongoose";
import contentConnection from "../config/content-database.js";

const spaceSchema = new mongoose.Schema({
  image: String, label: String, caption: String, alt: String,
  extension: String, reference: Boolean,
}, { _id: false });
const propertySchema = new mongoose.Schema({
  image: String, title: String, caption: String, alt: String,
  spaces: { type: [spaceSchema], default: undefined },
}, { _id: false });
const architectureSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  number: String, title: String, text: String,
  night: Boolean, landscape: Boolean,
  slides: [propertySchema],
});

export default contentConnection.model("Architecture", architectureSchema, "Arquitectura");
