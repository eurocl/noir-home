import { loadEnvironment, startApi } from "../runtime.js";
import { createUsersApp } from "./app.js";
import { serviceDatabase } from "../database-config.js";

loadEnvironment();
await startApi(createUsersApp(), {
  name: "Usuarios",
  port: process.env.USERS_PORT || 3001,
  ...serviceDatabase("users"),
});
