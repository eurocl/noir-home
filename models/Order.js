import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  cartId: { type: mongoose.Schema.Types.ObjectId, required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'rejected'], default: 'pending', required: true },
  demo: { type: Boolean, default: true, immutable: true },
  items: [{
    _id: false,
    productId: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPriceCents: { type: Number, required: true, min: 0 },
  }],
  totalCents: { type: Number, required: true, min: 0 },
  reason: String,
  confirmedAt: Date,
}, { timestamps: true });

export default mongoose.model('Order', orderSchema);
