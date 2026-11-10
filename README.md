# Proyecto Noir

La web reúne galerías de arquitectura y un catálogo de productos para el hogar. Permite registrarse, iniciar sesión y guardar productos en un carrito, recorrer galerias. No incluye compras ni pagos.

## Administración del catálogo

Una cuenta con rol `admin` puede ingresar a `/admin` después de iniciar sesión. El panel permite consultar productos y stock, crear productos con existencias iniciales y eliminarlos con confirmación. Por ahora se usan imágenes que ya existen en `public/images`, no se suben archivos ni se editan productos existentes desde el panel.

El backend web conserva el token en la sesión y verifica el rol mediante Usuarios antes de mostrar el panel o procesar formularios. Los formularios usan un token CSRF. Productos vuelve a validar el JWT y el rol administrador. Si el token vence, hay que iniciar sesión nuevamente.

## Organizacion

Este repositorio contiene la web. Los tres backends están separados:

- Usuarios: https://github.com/eurocl/noir-usuarios
- Productos: https://github.com/eurocl/noir-productos
- Inventario: https://github.com/eurocl/noir-inventario

Cada backend tiene su propio despliegue de Render y clúster de Atlas. La web los consulta por HTTP. El carrito sigue en la base de la web.

## Arranque

1. Instalar Node.js 24
2. Ejecutar npm ci
3. Completar .env a partir de .env.ejemplo
4. Configurar las URLs de los tres servicios, locales o publicadas
5. Ejecutar npm start y abrir http://localhost:3000

Para levantar los backends en la PC, ejecutar npm start en cada repositorio. Usuarios usa 3001, Productos 3002 e Inventario 3003. Las instrucciones de conexión están en sus README.

## Archivos principales

- app.js: servidor web, sesión y carrito
- routes/product-gateway.js: consulta de productos e inventario
- services/client.js: comunicación con las APIs
- views/pages: páginas EJS
- public: estilos, JavaScript e imágenes
- models y config: carrito y conexión de contenido

Las galerías se leen de Hijos.Arquitectura en nuestro clúster original de Atlas. Hay seis galerías con once propiedades. Los documentos guardan títulos, descripciones y referencias a las imágenes de public/images/architecture. Son visualizaciones conceptuales y algunas son imagenes recolectadas de internet. data/architecture.json conserva una copia local que la web muestra con un aviso si falla MongoDB.  Para habilitar Arquitectura, configurar MONGO_CONTENT_URI y CONTENT_ENABLED=true en la web. Esta conexión pertenece a la web, no es un cuarto microservicio.

## Comprobaciones y publicacion

 render.yaml configura únicamente la web. Los otros servicios se despliegan desde sus respectivos repositorios.

-------Web publicada: https://noir-home-2mu6.onrender.com

No hay subidos archivos .env, node_modules ni respaldos de datos.
