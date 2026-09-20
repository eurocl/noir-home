import mongoose from "mongoose";

// Independent connection for architecture references and testimonials.
const contentConnection = mongoose.createConnection();

export default contentConnection;
