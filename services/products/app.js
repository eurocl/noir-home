import mongoose from "mongoose";
import Product from "../../models/Product.js";
import auth from "../../middleware/auth.js";
import { createApi } from "../runtime.js";
import { requestService } from "../client.js";

export function createProductsApp() {
  const app = createApi("products");
  app.param("id", (req, res, next, id) => {
    if (!mongoose.isObjectIdOrHexString(id)) return res.status(400).json({ message: "Identificador de producto inválido" });
    next();
  });
  app.get("/products", async (req, res) => {
    try { res.json(await Product.find()); }
    catch { res.status(500).json({ message: "No se pudieron consultar los productos" }); }
  });
  app.get("/products/:id", async (req, res) => {
    try {
      const product = await Product.findById(req.params.id);
      if (!product) return res.status(404).json({ message: "Producto no encontrado" });
      res.json(product);
    } catch { res.status(500).json({ message: "No se pudo consultar el producto" }); }
  });
  app.post("/products", auth, async (req, res) => {
    const { name, category, description, price, image, stock = 0 } = req.body || {};
    if (![name, category, description, image].every(value => typeof value === "string" && value.trim()) ||
        typeof price !== "number" || !Number.isFinite(price) || price < 0 || !Number.isSafeInteger(stock) || stock < 0) {
      return res.status(400).json({ message: "Completá el producto con precio y stock válidos" });
    }
    const id = new mongoose.Types.ObjectId();
    try {
      await requestService("stock", `/internal/stock/${id}`, { method: "PUT", body: { stock }, internal: true });
      const product = await Product.create({ _id: id, name, category, description, price, image });
      res.status(201).json({ message: "Product created", product });
    } catch (error) {
      try {
        // Never remove inventory if MongoDB committed the product before a timeout.
        if (!await Product.findById(id)) await requestService("stock", `/internal/stock/${id}`, { method: "DELETE", internal: true });
      } catch { console.warn(`Revisar consistencia del producto ${id}: no se pudo completar la compensación.`); }
      res.status(error.status || 500).json({ message: "No se pudo confirmar la creación del producto", productId: id });
    }
  });
  app.delete("/products/:id", auth, async (req, res) => {
    let inventory;
    try {
      const product = await Product.findById(req.params.id);
      if (!product) return res.status(404).json({ message: "Producto no encontrado" });
      try { inventory = await requestService("stock", `/stock/${req.params.id}`); }
      catch (error) { if (error.status !== 404) throw error; }
      await requestService("stock", `/internal/stock/${req.params.id}`, { method: "DELETE", internal: true });
      await Product.findByIdAndDelete(req.params.id);
      res.json({ message: "Product deleted" });
    } catch (error) {
      try {
        if (inventory && await Product.findById(req.params.id)) {
          await requestService("stock", `/internal/stock/${req.params.id}`, { method: "PUT", body: { stock: inventory.stock }, internal: true });
        }
      } catch { console.warn(`Revisar inventario del producto ${req.params.id}: no se pudo completar la compensación.`); }
      res.status(error.status || 500).json({ message: "No se pudo confirmar la eliminación del producto" });
    }
  });
  return app;
}
