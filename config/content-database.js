import mongoose from "mongoose";

// Conexion independiente para el contenido de arquitectura.
const contentConnection = mongoose.createConnection();

export default contentConnection;
