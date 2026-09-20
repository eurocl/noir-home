import dotenv from "dotenv";
import dns from "node:dns";
import mongoose from "mongoose";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { listenOptions, validateServiceUrls } from "./deployment.js";

export function loadEnvironment() {
  dotenv.config({ path: new URL("../.env", import.meta.url) });
}

export function createApi(name) {
  const app = express();
  if (process.env.RENDER === "true") app.set("trust proxy", 1);
  app.use(helmet());
  app.use(express.json());
  app.get("/health", (req, res) => {
    const ready = mongoose.connection.readyState === 1;
    res.status(ready ? 200 : 503).json({ service: name, ready });
  });
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 }));
  return app;
}

export async function startApi(app, { name, port, uri, dbName, dependencies = [], requireInternalSecret = false, requireJwt = true }) {
  try {
    if (!uri) throw new Error("Falta la conexión MongoDB");
    if (requireJwt && !process.env.JWT_SECRET) throw new Error("Falta JWT_SECRET");
    if (requireInternalSecret && !process.env.INTERNAL_SERVICE_SECRET) throw new Error("Falta INTERNAL_SERVICE_SECRET");
    validateServiceUrls(dependencies);
    const listener = listenOptions(port);
    if (process.env.MONGO_DNS_SERVERS) dns.setServers(process.env.MONGO_DNS_SERVERS.split(",").map(value => value.trim()));
    await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 10000 });
    const server = app.listen(listener.port, listener.host, () => console.log(`${name}: ${listener.host}:${listener.port}`));
    server.on("error", async () => {
      console.error(`${name}: no se pudo abrir el puerto ${port}`);
      await mongoose.disconnect();
      process.exitCode = 1;
    });
    const stop = () => server.close(async () => { await mongoose.disconnect(); });
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
  } catch {
    console.error(`${name}: no se pudo iniciar. Revisá la conexión MongoDB y las variables requeridas.`);
    await mongoose.disconnect();
    process.exitCode = 1;
  }
}
