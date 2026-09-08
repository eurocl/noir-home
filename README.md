# Noir Home

Sitio de objetos para el hogar y catálogo conceptual de arquitectura brutalista, construido con Express, EJS y MongoDB Atlas.

## Iniciar el proyecto

1. Instalá Node.js 24 y ejecutá `npm ci` desde esta carpeta.
2. Copiá `.env.example` a `.env` y configurá la conexión de MongoDB y los secretos de sesión y JWT.
3. Ejecutá `npm start` y abrí http://localhost:3000.

El servidor comienza a escuchar después de conectarse a MongoDB. `MONGO_DNS_SERVERS` es opcional y permite configurar un DNS para resolver Atlas cuando la red lo requiere.

## Catálogo

Diez propuestas arquitectónicas en tres estilos, con galerías individuales de fachada, dormitorio, cocina, baño, piscina y patio. Las imágenes son visualizaciones conceptuales generadas con IA; se conservan también los ambientes originales.

Los archivos de imágenes están en `public/images/architecture`. Las galerías se definen en `views/pages/catalog.ejs` y se presentan con `views/pages/property-gallery.ejs`.

Las descripciones de los productos se almacenan en MongoDB. El script `scripts/translate-descriptions.js` permite aplicar las traducciones del catálogo original y guarda una copia local antes de modificarlo.

## Configuración privada

No subir `.env`, copias de datos ni `node_modules`. Las dependencias se instalan con `npm ci`. El servicio opcional `ms-validation` tiene sus propias dependencias y necesita `PORT` y `JWT_SECRET` en su entorno; el secreto JWT debe coincidir con el del servidor principal.
