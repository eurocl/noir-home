import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const children = [];
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) if (child.exitCode === null) child.kill();
}
for (const entry of ["services/users/server.js", "services/products/server.js", "services/stock/server.js", "app.js"]) {
  const child = spawn(process.execPath, [entry], { cwd: root, stdio: "inherit", windowsHide: true });
  children.push(child);
  child.on("error", () => stop(1));
  child.on("exit", code => { if (!stopping) stop(code || 1); });
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
