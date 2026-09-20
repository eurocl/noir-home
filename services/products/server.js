import { loadEnvironment, startApi } from "../runtime.js";
import { createProductsApp } from "./app.js";
import { serviceDatabase } from "../database-config.js";

loadEnvironment();
await startApi(createProductsApp(), {
  name: "Productos",
  dependencies: ["stock"],
  requireInternalSecret: true,
  port: process.env.PRODUCTS_PORT || 3002,
  ...serviceDatabase("products"),
});
