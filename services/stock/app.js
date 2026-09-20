import mongoose from "mongoose";
import { createApi } from "../runtime.js";
import { internalAuth } from "../internal-auth.js";

// _id is the product ID. Quantities belong exclusively to this database.
const inventorySchema = new mongoose.Schema({ stock: { type: Number, required: true, min: 0, validate: Number.isSafeInteger } });
export const Inventory = mongoose.model("Inventory", inventorySchema, "inventory");

export function createStockApp() {
  const app = createApi("stock");
  app.param("id", (req, res, next, id) => {
    if (!mongoose.isObjectIdOrHexString(id)) return res.status(400).json({ message: "Identificador de producto inválido" });
    next();
  });
  app.get("/stock", async (req, res) => {
    try {
      const items = await Inventory.find({}, { stock: 1 }).lean();
      res.json(items.map(item => ({ productId: item._id, stock: item.stock ?? 0 })));
    } catch { res.status(500).json({ message: "No se pudo consultar el stock" }); }
  });
  app.get("/stock/:id", async (req, res) => {
    try {
      const item = await Inventory.findById(req.params.id, { stock: 1 }).lean();
      if (!item) return res.status(404).json({ message: "Producto no encontrado" });
      res.json({ productId: item._id, stock: item.stock ?? 0 });
    } catch { res.status(500).json({ message: "No se pudo consultar el stock" }); }
  });
  app.put("/internal/stock/:id", internalAuth, async (req, res) => {
    const { stock } = req.body || {};
    if (!Number.isSafeInteger(stock) || stock < 0) return res.status(400).json({ message: "Stock inválido" });
    try {
      // Retrying initialization must never reset inventory that already exists.
      const item = await Inventory.findOneAndUpdate({ _id: req.params.id }, { $setOnInsert: { stock } }, { upsert: true, new: true, runValidators: true });
      res.json({ productId: item._id, stock: item.stock });
    } catch { res.status(500).json({ message: "No se pudo inicializar el stock" }); }
  });
  app.delete("/internal/stock/:id", internalAuth, async (req, res) => {
    try {
      await Inventory.deleteOne({ _id: req.params.id });
      res.json({ deleted: true });
    } catch { res.status(500).json({ message: "No se pudo eliminar el stock" }); }
  });
  return app;
}
