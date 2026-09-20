import mongoose from "mongoose";
import dotenv from "dotenv";

import Product from "./models/Product.js";
import { serviceDatabase } from "./services/database-config.js";

dotenv.config();

async function fixCategory(){

  try{

    const { uri, dbName } = serviceDatabase("products");
    await mongoose.connect(uri, { dbName });

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
