import mongoose from "mongoose";

const cartSchema = new mongoose.Schema({

  checkoutOrderId: { type: mongoose.Schema.Types.ObjectId, default: null },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  products: [

    {

      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },

      quantity: {
        type: Number,
        default: 1,
      },

    },

  ],

}, { optimisticConcurrency: true });

const Cart = mongoose.model(
  "Cart",
  cartSchema
);

export default Cart;
