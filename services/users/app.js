import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../../models/User.js";
import auth from "../../middleware/auth.js";
import { createApi } from "../runtime.js";

export function createUsersApp() {
  const app = createApi("users");
  app.post("/users/register", async (req, res) => {
    const { name, email, password } = req.body || {};
    if (![name, email, password].every(value => typeof value === "string" && value.trim())) {
      return res.status(400).json({ message: "Completá todos los campos" });
    }
    if (!/^(?=.*[0-9])(?=.*[!@#$%^&*]).{6,}$/.test(password)) {
      return res.status(400).json({ message: "La contraseña debe tener al menos 6 caracteres, un número y un carácter especial (!@#$%^&*)" });
    }
    try {
      if (await User.findOne({ email })) return res.status(409).json({ message: "Ya existe una cuenta con ese correo electrónico" });
      const user = await User.create({ name, email, password: await bcrypt.hash(password, 10) });
      res.status(201).json({ user: { id: user._id, name: user.name, email: user.email } });
    } catch (error) {
      res.status(error.code === 11000 ? 409 : 500).json({ message: "No se pudo crear la cuenta. Intentá nuevamente." });
    }
  });
  app.post("/users/login", async (req, res) => {
    const { email, password } = req.body || {};
    if (typeof email !== "string" || typeof password !== "string") return res.status(400).json({ message: "Completá correo y contraseña" });
    try {
      const user = await User.findOne({ email });
      if (!user || !await bcrypt.compare(password, user.password)) return res.status(401).json({ message: "Correo o contraseña incorrectos" });
      const token = jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "1h" });
      res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
    } catch {
      res.status(500).json({ message: "No se pudo iniciar sesión. Intentá nuevamente." });
    }
  });
  app.get("/users/me", auth, async (req, res) => {
    try {
      const user = await User.findById(req.user.userId);
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });
      res.json({ id: user._id, name: user.name, email: user.email });
    } catch {
      res.status(500).json({ message: "No se pudo consultar el usuario" });
    }
  });
  return app;
}
