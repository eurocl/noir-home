# Proyecto Noir

Sitio de objetos para el hogar y catálogo conceptual de arquitectura brutalista, construido con Express, EJS y MongoDB Atlas.

## Iniciar el proyecto

1. Instalá Node.js 24 y ejecutá `npm ci` desde esta carpeta.
2. Copiá `.env.example` a `.env` y configurá las conexiones de MongoDB y los secretos de sesión, JWT e `INTERNAL_SERVICE_SECRET`. `MONGO_URI` conecta al clúster propio y conserva la base del carrito indicada en su dirección; los tres servicios seleccionan las bases de `MONGO_USERS_DB`, `MONGO_PRODUCTS_DB` y `MONGO_STOCK_DB`. `MONGO_CONTENT_URI` contiene arquitectura y opiniones externas.
3. Ejecutá `npm run start:all` y abrí http://localhost:3000. Este comando inicia la web y los tres servicios en procesos separados.

Cada servicio inicia después de conectar su base. La web necesita la conexión del carrito, pero arquitectura y opiniones se conectan en segundo plano: una caída de la base externa no bloquea usuarios, productos ni stock. `CONTENT_ENABLED=false` permite pausar ese contenido. `MONGO_DNS_SERVERS` es opcional y permite configurar un DNS para resolver Atlas cuando la red lo requiere.

## Servicios y direcciones locales

Para publicar los cuatro servicios gratuitos, seguir [RENDER.md](RENDER.md). `render.yaml` incluye una plantilla para una instalación nueva; la guía también explica cómo conservar la web existente.

| Componente | Dirección | Inicio individual |
| --- | --- | --- |
| Web y carrito | http://localhost:3000 | `npm start` |
| Usuarios | http://localhost:3001/health | `npm run start:users` |
| Productos | http://localhost:3002/products | `npm run start:products` |
| Stock | http://localhost:3003/stock | `npm run start:stock` |

Usuarios ofrece `POST /users/register`, `POST /users/login` y `GET /users/me` (con `Authorization: Bearer TOKEN`). No expone una lista pública de cuentas ni sus contraseñas. Productos ofrece `GET /products`, `GET /products/:id`, `POST /products` y `DELETE /products/:id`; las escrituras mantienen la autenticación JWT existente. Stock ofrece `GET /stock` y `GET /stock/:id`, donde `id` es el identificador de un producto. Cada servicio tiene `/health`, que responde 503 si su conexión MongoDB no está lista.

La web consulta usuarios y productos por HTTP, mantiene las sesiones y resuelve los productos del carrito mediante la API. También publica `/stock` y `/products/:id/stock` como accesos al servicio de stock. Los puertos y las URLs se configuran con `USERS_PORT`, `PRODUCTS_PORT`, `STOCK_PORT` y sus correspondientes variables `*_SERVICE_URL`. Si cambiás un puerto, actualizá también su URL. Los servicios escuchan en 127.0.0.1; estas direcciones son locales, no enlaces publicados en Internet.

Los tres servicios usan bases distintas en el mismo clúster:

| Servicio | Base por defecto | Colección |
| --- | --- | --- |
| Usuarios | `noir_usuarios` | `users` |
| Productos | `noir_productos` | `products` |
| Stock | `noir_inventario` | `inventory` |

El stock ya no se almacena en el producto. Cada registro de inventario usa como `_id` el ID de su producto y contiene `stock`. Las variables `MONGO_USERS_DB`, `MONGO_PRODUCTS_DB` y `MONGO_STOCK_DB` seleccionan estas bases. `MONGO_USERS_URI`, `MONGO_PRODUCTS_URI` y `MONGO_STOCK_URI` permiten usar credenciales o clústeres específicos; si se omiten, se usa `MONGO_URI`. Compartir una credencial no impone permisos exclusivos por base: el control de acceso de Atlas se configura por separado.

Crear un producto inicializa su inventario mediante una API interna de stock. Las operaciones internas requieren `INTERNAL_SERVICE_SECRET`, que nunca se envía al navegador. Reintentar la inicialización conserva las existencias ya registradas. Eliminar un producto elimina también su inventario; ante errores se intenta compensar la operación y se devuelve un error. Son dos escrituras en servicios distintos, sin una transacción distribuida: si ambos servicios fallan durante la compensación, se registra el ID para revisar consistencia. No se agregó un sistema de reservas ni descuento de stock al carrito.

## Migración de las bases

La migración del 20/09/2026 copió 7 usuarios, 44 productos y 44 registros de inventario, conservando IDs, contraseñas almacenadas y cantidades. Los 3 carritos permanecen en la base de origen y la web resuelve sus productos por HTTP. Tres usuarios antiguos solo tienen `username`; se conservaron íntegros y el índice único de email se aplica únicamente a documentos con correo. La pantalla de acceso actual sigue usando email y no convierte automáticamente esas cuentas antiguas.

`node scripts/migrate-service-databases.js --check` revisa conflictos sin escribir. `--apply` requiere detener los servicios locales, respalda datos y configuración, inserta solo documentos faltantes, compara el contenido completo, comprueba que el origen no cambió y activa las bases en `.env`. Nunca sobrescribe registros diferentes ni elimina el origen. Los respaldos BSON Extended JSON conservan ObjectIds y fechas y están en `backups/database-separation-*/`, junto con `original.env`, índices y un manifiesto de verificación. Son privados y están excluidos de Git.

Las colecciones originales de `test` se conservaron como referencia de la migración; usuarios y productos ya no las usan. No son un respaldo actualizado de las nuevas bases. No vuelvas a apuntar un servicio a ellas después de generar datos nuevos sin reconciliar antes los cambios. El script de migración aborta si encuentra diferencias en destinos existentes, para evitar reemplazar datos posteriores.

`npm run test:services` comprueba por HTTP registro, login, perfiles, productos, stock, carrito y fallas de servicios con repositorios simulados, sin escribir en MongoDB. `ms-validation` sigue siendo opcional y se inicia por separado desde su carpeta con un puerto distinto a 3000–3003.

## Catálogo

Diez propuestas arquitectónicas en tres estilos, con galerías individuales de fachada, dormitorio, cocina, baño, piscina y patio. Las imágenes son visualizaciones conceptuales generadas con IA; se conservan también los ambientes originales.

Los archivos de imágenes están en `public/images/architecture`. Las galerías se definen en `views/pages/catalog.ejs` y se presentan con `views/pages/property-gallery.ejs`.

Las descripciones de los productos se almacenan en MongoDB. El script `scripts/translate-descriptions.js` permite aplicar las traducciones del catálogo original y guarda una copia local antes de modificarlo.

## Arquitectura y opiniones desde MongoDB

La portada y `/catalog` agregan referencias de la colección `Arquitectura`, con los campos `título`, `estilo`, `imagen` y `descripción`. Las galerías conceptuales originales se mantienen debajo de esta sección.

El bazar (`/bazar`) muestra opiniones de la colección `Personas`, con los campos `nombre`, `role`, `imagen` y `comentario`. Ambas colecciones conservan exactamente esos nombres, incluidas las mayúsculas y las tildes de sus campos. Las rutas de consulta `/architecture` y `/people` devuelven sus registros en JSON.

Si las colecciones están vacías, las páginas muestran un mensaje de disponibilidad. La integración no crea ni migra documentos: arquitectura y opiniones deben existir en la base configurada en `MONGO_CONTENT_URI`. Las imágenes pueden usar rutas locales o direcciones HTTPS. Esta conexión queda en el servidor web; `ms-validation` sigue siendo un servicio separado que valida tokens sin acceder a MongoDB.

## Configuración privada

No subir `.env`, copias de datos ni `node_modules`. Las dependencias se instalan con `npm ci`. El servicio opcional `ms-validation` tiene sus propias dependencias y necesita `PORT` y `JWT_SECRET` en su entorno; el secreto JWT debe coincidir con el del servidor principal.
