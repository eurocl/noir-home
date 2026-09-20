import { loadEnvironment, startApi } from "../runtime.js";
import { createStockApp } from "./app.js";
import { serviceDatabase } from "../database-config.js";

loadEnvironment();
await startApi(createStockApp(), {
  name: "Stock",
  requireInternalSecret: true,
  requireJwt: false,
  port: process.env.STOCK_PORT || 3003,
  ...serviceDatabase("stock"),
});
