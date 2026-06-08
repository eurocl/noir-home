import mongoose from "mongoose";
import dotenv from "dotenv";

import Product from "./models/Product.js";

dotenv.config();

async function fixCategory(){

  try{

    await mongoose.connect(
      process.env.MONGO_URI
    );

    await Product.updateOne(
      { name: "Noir Lamp" },
      {
        $set: {
          category: "Lighting"
        }
      }
    );

    console.log(
      "✅ Categoría agregada"
    );

    process.exit();

  } catch(err){

    console.log(err);

  }

}

fixCategory();