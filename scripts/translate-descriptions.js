import fs from "node:fs/promises";
import dns from "node:dns";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Product from "../models/Product.js";

dotenv.config({ path: new URL("../.env", import.meta.url), quiet: true });
if (process.env.MONGO_DNS_SERVERS) {
  dns.setServers(process.env.MONGO_DNS_SERVERS.split(",").map(value => value.trim()));
}

const translations = new Map([
  ["Minimal sculptural lounge chair in boucle fabric", "Sillón de descanso de diseño escultórico y minimalista, tapizado en tela bouclé."],
  ["Hand-carved natural wood mate with rustic finish", "Mate de madera natural tallado a mano, con acabado rústico."],
  ["Vintage-inspired metal kettle for tea rituals", "Pava de metal de inspiración vintage para disfrutar del ritual del té."],
  ["Dark metallic tea set with elegant finish", "Juego de té de metal oscuro con un acabado elegante."],
  ["Luxury marble tea set with smooth details", "Juego de té de lujo en mármol, con detalles suaves."],
  ["Soft upholstered bed inspired by floating clouds", "Cama de tapizado suave inspirada en la ligereza de las nubes."],
  ["Low Japanese-inspired minimalist bed frame", "Estructura de cama baja de diseño minimalista e inspiración japonesa."],
  ["Slim Scandinavian floor lamp with warm light", "Lámpara de pie de estilo escandinavo, con una silueta esbelta y luz cálida."],
  ["Modern stone-textured bedside lamp", "Lámpara de mesa de luz moderna con textura de piedra."],
  ["Elegant hanging lamp with matte black finish", "Lámpara colgante elegante con acabado negro mate."],
  ["Deep velvet sofa designed for modern interiors", "Sofá profundo de terciopelo, diseñado para interiores modernos."],
  ["Solid oak coffee table with natural texture", "Mesa ratona de roble macizo con textura natural."],
  ["Tall minimalist bookshelf in dark wood", "Biblioteca alta de diseño minimalista en madera oscura."],
  ["Decorative concrete vase for dry flowers", "Florero decorativo de hormigón para flores secas."],
  ["Soft linen curtains with natural folds", "Cortinas de lino suave con pliegues naturales."],
  ["Heavy wool blanket for cozy interiors", "Manta gruesa de lana para crear ambientes acogedores."],
  ["Wall-mounted nightstand with hidden drawer", "Mesa de luz flotante con cajón oculto."],
  ["Minimal white ceramic sink with matte finish", "Bacha minimalista de cerámica blanca con acabado mate."],
  ["Elegant soap dispenser carved in stone", "Dispenser de jabón elegante tallado en piedra."],
  ["Premium cotton towels with soft texture", "Toallas de algodón de alta calidad con textura suave."],
  ["Modern circular mirror with black frame", "Espejo circular moderno con marco negro."],
  ["Matte black faucet with geometric design", "Grifería de diseño geométrico con acabado negro mate."],
  ["Minimal stoneware plates for modern dining", "Platos minimalistas de gres para una mesa moderna."],
  ["Natural wood serving tray with smooth finish", "Bandeja de madera natural para servir, con acabado suave."],
  ["Transparent coffee maker for specialty brewing", "Cafetera transparente para preparar café de especialidad."],
  ["Heavy marble cutting board with luxury finish", "Tabla de cortar de mármol de gran peso, con acabado de lujo."],
  ["Large neutral rug with soft wool texture", "Alfombra grande en tonos neutros con suave textura de lana."],
  ["Comfortable armchair with curved silhouette", "Sillón cómodo de silueta curva."],
  ["Minimal abstract artwork in monochrome palette", "Obra de arte abstracta y minimalista en una paleta monocromática."],
  ["Industrial hanging lantern with warm glow", "Farol colgante de estilo industrial con luz cálida."],
  ["Minimal wall light for ambient interiors", "Aplique de pared minimalista para iluminación ambiental de interiores."],
  ["Modern LED strip light with soft atmosphere", "Luz LED en tira de diseño moderno para crear una atmósfera suave."],
  ["Solid oak desk designed for creative workspaces", "Escritorio de roble macizo diseñado para espacios de trabajo creativos."],
  ["Ergonomic office chair with modern design", "Silla de oficina ergonómica de diseño moderno."],
  ["Minimal planter for indoor plants", "Maceta minimalista para plantas de interior."],
  ["Dark scented candle with woody aromas", "Vela aromática oscura con notas amaderadas."],
  ["Silent wall clock with clean typography", "Reloj de pared silencioso con tipografía sencilla."],
  ["Luxury freestanding bathtub in stone texture", "Bañera independiente de lujo con textura de piedra."],
  ["Matte black shower system with modern details", "Sistema de ducha en negro mate con detalles modernos."],
  ["Handcrafted glass terrarium with preserved moss and volcanic stones", "Terrario de vidrio artesanal con musgo preservado y piedras volcánicas."],
  ["Spherical terrarium inspired by miniature forest ecosystems", "Terrario esférico inspirado en ecosistemas de bosque en miniatura."],
  ["Modern desert terrarium with sand textures and small succulents", "Terrario desértico moderno con texturas de arena y pequeñas suculentas."],
  ["Test description", "Descripción de prueba."],
  ["Created from Render", "Creado desde Render."],
]);

try {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  const products = await Product.find().lean();
  const pending = products.filter(product => translations.has(product.description));
  const unknown = products.filter(product => !translations.has(product.description) && ![...translations.values()].includes(product.description));
  if (unknown.length) throw new Error(`Hay ${unknown.length} descripciones sin traducción revisada. No se modificó ningún producto.`);
  if (pending.length) {
    const backupDir = new URL("../backups/", import.meta.url);
    await fs.mkdir(backupDir, { recursive: true });
    const filename = `product-descriptions-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    await fs.writeFile(new URL(filename, backupDir), JSON.stringify(pending.map(({ _id, description }) => ({ _id, description })), null, 2), { flag: "wx" });
    const result = await Product.bulkWrite(pending.map(product => ({ updateOne: {
      filter: { _id: product._id, description: product.description },
      update: { $set: { description: translations.get(product.description) } },
      timestamps: false,
    } })));
    console.log(`Descripciones actualizadas: ${result.modifiedCount}/${pending.length}. Copia: backups/${filename}`);
    if (result.matchedCount !== pending.length) throw new Error("Algunos productos cambiaron durante la traducción; revisar antes de reintentar.");
  }
  const verified = await Product.find().lean();
  const originals = new Map(products.map(product => [String(product._id), product]));
  for (const product of verified) {
    const original = originals.get(String(product._id));
    if (!original) throw new Error("Cambió el catálogo durante la verificación.");
    const expected = { ...original, description: translations.get(original.description) ?? original.description };
    if (JSON.stringify(product) !== JSON.stringify(expected)) throw new Error("La verificación detectó un cambio inesperado.");
  }
  console.log(`Verificados ${verified.length} productos: solo se modificaron las descripciones.`);
} catch (error) {
  console.error(error.message.replace(/mongodb(?:\+srv)?:\/\/[^\s]+/g, "[URI oculta]"));
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
