# Publicación de Proyecto Noir

Cada componente se publica desde su propio repositorio. Todos usan Node.js 24, npm ci para instalar, npm start para iniciar y /health para comprobar la conexión a su base.

| Componente | Repositorio | URL |
| --- | --- | --- |
| Web | eurocl/noir-home, rama deploy/render-microservices | https://noir-home-2mu6.onrender.com |
| Usuarios | eurocl/noir-usuarios, rama main | https://noir-users.onrender.com |
| Productos | eurocl/noir-productos, rama main | https://noir-products.onrender.com |
| Inventario | eurocl/noir-inventario, rama main | https://noir-stock.onrender.com |

La web configura MONGO_URI para el carrito y MONGO_CONTENT_URI para Hijos, con CONTENT_ENABLED=true. Hijos.Arquitectura contiene seis galerías y once propiedades. Las imágenes se sirven desde public/images/architecture. Personas no tiene testimonios cargados.

Los tres backends configuran DATABASE_URL y DATABASE_NAME con su base y clúster propios. JWT_SECRET coincide entre Usuarios, Productos y la web. INTERNAL_SERVICE_SECRET coincide entre Productos e Inventario. Nunca publicar estas credenciales.

La web usa USERS_SERVICE_URL, PRODUCTS_SERVICE_URL y STOCK_SERVICE_URL con las direcciones HTTPS de la tabla. Productos también usa STOCK_SERVICE_URL. Render asigna PORT. render.yaml configura solamente la web.

Después de subir cada commit a GitHub, desplegar el servicio correspondiente desde Render. Verificar /health, el catálogo, la arquitectura, el detalle, el login y el carrito. Las sesiones de la web están en memoria y pueden perderse al reiniciar. Los datos persisten en Atlas.

El formulario de contacto abre la aplicación de correo del visitante. No envía mensajes automáticamente desde el servidor.
