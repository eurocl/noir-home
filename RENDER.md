# Publicar Noir en Render Free

El repositorio publicado es `eurocl/noir-home`. Los cuatro servicios usan el mismo código y distintas órdenes de inicio. MongoDB Atlas conserva las bases ya migradas; no hay que ejecutar la migración al construir o arrancar Render.

## Antes de publicar

Subir los cambios revisados de la copia `.github-publish` al repositorio. La carpeta de trabajo `noir-home-main` contiene la versión editable; `.github-publish` es la copia Git preparada para publicar. No subir `.env`, `node_modules` ni `backups`.

Si el servicio actual tiene despliegue automático, **no actualizar su rama de producción hasta configurar las dependencias y variables nuevas**, porque la web ya consulta los otros servicios. Se puede publicar primero en otra rama, crear los tres servicios desde esa rama y actualizar la web al final. Los cambios locales no actualizan Render hasta publicarlos y desplegarlos.

## Opción recomendada si ya existe la web: configuración manual

Crear primero usuarios y stock, luego productos. Al final, actualizar la web existente para conservar su URL. En todos: tipo **Web Service**, runtime **Node**, plan **Free**, mismo repositorio y región, Build Command `npm ci`, Health Check Path `/health`, Node 24. Root Directory vacío si `package.json` está en la raíz, como en la copia `.github-publish`; si publicás la carpeta contenedora completa, usar `noir-home-main`.

| Servicio | Start Command | Variables específicas |
| --- | --- | --- |
| Usuarios | `npm run start:users` | `MONGO_USERS_DB=noir_usuarios`, `JWT_SECRET` |
| Stock | `npm run start:stock` | `MONGO_STOCK_DB=noir_inventario`, `INTERNAL_SERVICE_SECRET` |
| Productos | `npm run start:products` | `MONGO_PRODUCTS_DB=noir_productos`, `JWT_SECRET`, `INTERNAL_SERVICE_SECRET`, `STOCK_SERVICE_URL` |
| Web existente | `npm start` | `JWT_SECRET`, `SESSION_SECRET`, `USERS_SERVICE_URL`, `PRODUCTS_SERVICE_URL`, `STOCK_SERVICE_URL`, `CONTENT_ENABLED=false` |

Todos necesitan `MONGO_URI`, `NODE_ENV=production`, `NODE_VERSION=24` y `SERVICE_TIMEOUT_MS=180000`. Copiar `MONGO_URI` de nuestra configuración local: no usar la conexión del compañero. Mantener exactamente el mismo `JWT_SECRET` en usuarios, productos y web. `INTERNAL_SERVICE_SECRET` debe coincidir en productos y stock; se puede reutilizar el valor local sin mostrarlo ni subirlo al repositorio. Crear un `SESSION_SECRET` aleatorio exclusivo de la web.

Las URLs deben ser las **direcciones públicas HTTPS reales** que Render muestra después de crear cada servicio, por ejemplo `https://nombre-asignado.onrender.com`, sin `/products`, `/stock` ni `/health` al final. No usar localhost, la dirección de la web principal ni el hostname de red privada. Productos necesita la URL de stock; la web necesita las tres URLs. No configurar manualmente `PORT`, `USERS_PORT`, `PRODUCTS_PORT` ni `STOCK_PORT`: cada proceso usa el `PORT` de Render y escucha en `0.0.0.0`.

En Atlas → Network Access, autorizar los rangos que Render muestra en **Connect → Outbound** para los servicios. Los permisos de tu IP doméstica no cubren las conexiones desde Render. Las credenciales elegidas deben poder acceder a las bases correspondientes. No cambiar las bases ni borrar las colecciones originales como parte de este despliegue.

## Alternativa: Blueprint para una instalación nueva

`render.yaml` define los cuatro servicios Free. Usar **New → Blueprint**, seleccionar el repositorio y revisar el plan antes de confirmar. Se solicitan `MONGO_URI` y `JWT_SECRET` para usuarios, e `INTERNAL_SERVICE_SECRET` para stock. La web genera su propio secreto de sesión. Las demás conexiones y secretos se referencian entre servicios; las URLs usan `RENDER_EXTERNAL_URL`, no la red privada.

Si ya tenés una web con otro nombre, este Blueprint puede crear una web adicional. Para conservar la URL existente, usá la configuración manual anterior o adaptá el nombre `proyecto-noir` en el generador al nombre exacto del servicio existente y revisá los cambios propuestos por Render. No aplicar a ciegas sobre el despliegue actual. El Blueprint está en JSON, un formato válido de YAML. Se regenera con `node scripts/build-render-blueprint.js`.

## Comprobar el despliegue

1. Abrir `/health` en las cuatro URLs: debe responder HTTP 200 y `ready: true`.
2. Abrir `/products` en productos: debe devolver 44 registros, salvo cambios posteriores del catálogo; los documentos ya no contienen `stock`.
3. Abrir `/stock` en stock: debe devolver 44 existencias enlazadas por `productId`.
4. En la web probar catálogo, bazar, detalle con disponibilidad, login y carrito. `/users/me` requiere un token; no es una lista pública de usuarios.

La web espera hasta tres minutos por cada llamada a un servicio. Las consultas GET toleran temporalmente una página HTML de arranque o errores 502/503/504. Antes de una escritura, consulta `/health` para despertar el servicio. **No reenvía automáticamente POST, PUT ni DELETE** cuando su resultado es incierto. El login muestra un estado de espera y evita envíos simultáneos.

Una cadena de servicios que están todos dormidos puede tardar más, y el tiempo de espera no garantiza disponibilidad. No hay pings periódicos para mantener servicios despiertos. Render Free comparte 750 horas mensuales por workspace y suspende cada servicio tras 15 minutos sin tráfico; los cuatro consumen ese cupo mientras están activos. Las sesiones siguen almacenadas en memoria, por lo que un reinicio o suspensión de la web puede requerir iniciar sesión otra vez. Los usuarios, productos, inventario y carritos persisten en Atlas.

El contenido del compañero sigue pausado con `CONTENT_ENABLED=false`. Para activarlo después: autorizar el acceso de Render a su Atlas, configurar `MONGO_CONTENT_URI` en la web y cambiar `CONTENT_ENABLED=true`.

Referencias: [servicios web](https://render.com/docs/web-services), [plan Free](https://render.com/docs/free), [Blueprints](https://render.com/docs/blueprint-spec), [variables de entorno](https://render.com/docs/environment-variables), [IP de salida](https://render.com/docs/outbound-ip-addresses).
