import express from "express";
import { requestService } from "../services/client.js";
import { findDisplayProduct, findRecentProduct } from "../services/catalog-cache.js";

const router = express.Router();
const fail = (res, error) => res.status(error.status || 500).json({ message: error.message });
const token = req => req.headers.authorization?.split(" ")[1];

router.get("/", async (req, res) => {
  try { res.json(await requestService("products", "/products")); }
  catch (error) { fail(res, error); }
});
router.get("/:id/stock", async (req, res) => {
  try { res.json(await requestService("stock", `/stock/${encodeURIComponent(req.params.id)}`, { timeoutMs: 8000 })); }
  catch (error) { fail(res, error); }
});
router.get("/:id", async (req, res) => {
  try {
    const id = encodeURIComponent(req.params.id);
    let product = findRecentProduct(req.params.id);
    let catalogDelayed = false;
    if (!product) {
      try {
        product = await requestService("products", `/products/${id}`, { timeoutMs: 3500 });
      } catch (error) {
        if (![429, 502, 503, 504].includes(error.status)) throw error;
        product = findDisplayProduct(req.params.id);
        if (!product) throw error;
        catalogDelayed = true;
      }
    }
    res.render("pages/product", { product, catalogDelayed, userId: req.session?.userId, userName: req.session?.userName });
  } catch (error) { fail(res, error); }
});
router.post("/", async (req, res) => {
  try { res.status(201).json(await requestService("products", "/products", { method: "POST", body: req.body, token: token(req) })); }
  catch (error) { fail(res, error); }
});
router.delete("/:id", async (req, res) => {
  try { res.json(await requestService("products", `/products/${encodeURIComponent(req.params.id)}`, { method: "DELETE", token: token(req) })); }
  catch (error) { fail(res, error); }
});
export default router;
