# Tienda de café de especialidad

Flujo de compra con tarjeta para una tienda de café de especialidad. Plan: [docs/PLAN.md](docs/PLAN.md). Criterios de aceptación: [docs/ACCEPTANCE_CRITERIA.md](docs/ACCEPTANCE_CRITERIA.md).

## Despliegue público

| Qué              | Dónde                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Aplicación       | https://d2eds6bsugsp7t.cloudfront.net                                                                                     |
| Documentación    | https://d2eds6bsugsp7t.cloudfront.net/api/docs (Swagger UI) y `/api/docs/openapi.json` (especificación OpenAPI)           |
| Compra de prueba | Tarjeta `4242 4242 4242 4242`, vencimiento futuro, código de 3 dígitos y nombre de 5 o más caracteres: el pago se aprueba |

Los pagos usan el entorno de pruebas (sandbox) del proveedor de pagos: no se mueve dinero real. La tarjeta `4111 1111 1111 1111` se rechaza.

## Requisitos

Node 22 (`.nvmrc`) y npm 10.

## Comandos

| Comando                                              | Acción                                                                            |
| ---------------------------------------------------- | --------------------------------------------------------------------------------- |
| `npm ci`                                             | Instala las dependencias de todos los workspaces                                  |
| `npm run lint` / `npm run format:check`              | ESLint / Prettier                                                                 |
| `npm run test:cov`                                   | Jest con cobertura mínima del 80 %                                                |
| `npm run build`                                      | Compila backend y frontend                                                        |
| `npm run start:dev -w backend`                       | API en `:3000`, Swagger en `/docs`                                                |
| `npm run dev -w frontend`                            | Aplicación web en `:5173`                                                         |
| `npm run seed -w backend`                            | Carga los 6 cafés en DynamoDB (se puede repetir sin duplicar)                     |
| `npm run openapi -w backend`                         | Regenera `docs/openapi.json`                                                      |
| `npm run package:lambda -w backend`                  | Genera `backend/build/lambda` (código y dependencias de producción)               |
| `npm test -w e2e`                                    | Pruebas de extremo a extremo en Chrome móvil (ver [e2e/README.md](e2e/README.md)) |
| `python3 frontend/scripts/generate-coffee-images.py` | Regenera las imágenes de los cafés (requiere Pillow)                              |

Copia `.env.example` a `.env`, complétalo en local y expórtalo antes de ejecutar `start:dev`. No lo subas al repositorio. DynamoDB requiere credenciales de AWS.

## API

La interfaz Swagger está en `/docs` de la API en ejecución. La especificación está en [docs/openapi.json](docs/openapi.json); un test falla si la especificación no coincide con el código.

| Endpoint                  | Función                                                        | Errores                      |
| ------------------------- | -------------------------------------------------------------- | ---------------------------- |
| `GET /products`           | Lista los cafés con tamaños, precios y stock                   | 429                          |
| `GET /checkout/options`   | Devuelve los términos a aceptar (de un solo uso) y las tarifas | 429, 503                     |
| `POST /checkout`          | Reserva el stock, crea el pedido y cobra                       | 400, 404, 409, 413, 422, 429 |
| `GET /transactions/:id`   | Estado del pedido; consulta al proveedor si está `PENDING`     | 404, 429                     |
| `GET /deliveries/:id`     | Entrega asignada a un pedido pagado                            | 404, 429                     |
| `POST /webhooks/payments` | Evento de pago firmado (idempotente)                           | 400, 401, 404, 413, 422      |

Límites: cuerpos de hasta 16 KB, 60 peticiones por minuto por cliente (10 en `POST /checkout`) y CORS solo para el origen de `CORS_ORIGIN`. Flujo de pago: [docs/PAYMENTS.md](docs/PAYMENTS.md).

## Modelo de datos

DynamoDB, una tabla por entidad, con facturación bajo demanda. Los nombres de las tablas son `<TABLE_PREFIX>-<nombre>`.

| Tabla          | Clave                | Contenido                                                                                                                  |
| -------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `products`     | `id`                 | Nombre, descripción e imagen                                                                                               |
| `variants`     | `id`                 | `productId`, tamaño en gramos, precio en centavos y `stock` (solo se modifica con escrituras condicionales)                |
| `customers`    | `email`              | `id` y nombre                                                                                                              |
| `transactions` | `id`                 | Estado, `customerId`, variante, cantidad, importes, datos de entrega y referencia del proveedor; marcadores `IDEM#<clave>` |
| `deliveries`   | `id` (= transacción) | Cliente, variante, cantidad, destinatario, dirección, ciudad, teléfono y estado `ASSIGNED`                                 |

El cierre de un pago es una sola escritura atómica. Si el pago se aprueba, se cierra la transacción y se asigna la entrega. Si se rechaza o falla, se cierra la transacción y se devuelve el stock. Solo existe entrega para un pago aprobado.

## Despliegue

AWS CDK en `infra/`, región `us-east-2`. Una sola URL de CloudFront sirve la aplicación web y `/api/*`, por lo que el navegador solo llama a su propio origen y CORS permanece cerrado.

| Componente        | Recurso                                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------------------------- |
| `CoffeeStoreData` | 5 tablas DynamoDB bajo demanda; recuperación a un punto en el tiempo en pedidos y entregas                      |
| `CoffeeStoreApp`  | Lambda (Node 22, arm64), API HTTP (50 peticiones por segundo), bucket S3 privado y CloudFront                   |
| Secretos          | Parámetros SecureString de SSM `/coffee-store/payment-*`, leídos por la Lambda; no están en el código           |
| Borde             | Dos funciones de CloudFront: una quita el prefijo `/api` y otra envía las rutas de la aplicación a `index.html` |
| Consola de AWS    | Todo lleva la etiqueta `Project=coffee-store`; en Resource Groups está el grupo `coffee-store`                  |

| Paso | Comando                                                                                        |
| ---- | ---------------------------------------------------------------------------------------------- |
| 1    | `aws login --profile coffee-store` y luego `export AWS_PROFILE=coffee-store`                   |
| 2    | `npx cdk bootstrap aws://<cuenta>/us-east-2 -w infra` (una vez por cuenta)                     |
| 3    | Exportar `.env` y ejecutar `npm run secrets -w infra` (guarda los 3 secretos en SSM)           |
| 4    | `npm run deploy -w infra` (empaqueta, compila, despliega y carga los datos); muestra `SiteUrl` |
| 5    | `npm run smoke -w infra -- <SiteUrl>`                                                          |
| 6    | `npx cdk destroy --all -w infra` elimina todo, incluidos las tablas y el bucket                |

Limitaciones: el certificado por defecto de CloudFront no permite elegir la versión mínima de TLS; para hacerlo se necesita un dominio propio. `npm audit` reporta una vulnerabilidad moderada en `minimatch`, incluido dentro de `aws-cdk-lib`; solo se ejecuta en el equipo del desarrollador al sintetizar la plantilla.

## Pruebas

Jest en los tres workspaces. CI las ejecuta en cada pull request y exige un mínimo del 80 % (`coverageThreshold`).

| Workspace  | Tests | Sentencias | Ramas   | Funciones | Líneas  |
| ---------- | ----- | ---------- | ------- | --------- | ------- |
| `frontend` | 466   | 98,24 %    | 94,39 % | 98,66 %   | 99,06 % |
| `backend`  | 510   | 98,92 %    | 94,25 % | 99,42 %   | 99,73 % |
| `infra`    | 36    | 100 %      | 100 %   | 100 %     | 100 %   |

**Extremo a extremo.** Más de 40 casos con Playwright en un Chrome móvil de 375 px y los mismos en Firefox y unos pocos sobre el sitio desplegado, que no compran ni guardan datos. Cubren la compra completa, los avisos y textos, la recuperación tras recargar y los casos adversarios. Detalle en [e2e/README.md](e2e/README.md).

Los tests del backend usan implementaciones en memoria de cada puerto, por lo que no necesitan red ni AWS. Los casos adversarios están automatizados: importes alterados, ráfagas de peticiones, webhooks reenviados, identificadores maliciosos y compras en paralelo de la última unidad.

## Decisiones del backend

| Decisión                                                                          | Motivo                                                                                                      | Costo                                                                           |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Arquitectura hexagonal: `domain` no importa framework, base de datos ni proveedor | Las reglas de negocio se prueban sin Nest, AWS ni red                                                       | Más archivos que un servicio simple de controlador a base de datos              |
| Los casos de uso devuelven un `Result` (Railway Oriented Programming)             | Cada fallo es un valor con un código estable; no hay `try/catch` repartidos                                 | Quien llama debe leer el resultado; la capa HTTP lo hace en un solo lugar       |
| DynamoDB, una tabla por entidad, bajo demanda                                     | Sin servidores, sin cargo mientras no se usa y con escrituras condicionales atómicas para el stock          | No hay joins: cada entidad se lee por su clave                                  |
| El stock se reserva al crear el pedido `PENDING`                                  | Dos compradores de la última unidad no pueden tener éxito a la vez; si el pago falla, la unidad se devuelve | Un pedido `PENDING` mantiene el stock reservado hasta que se cierra             |
| El cierre del pago es una sola escritura atómica                                  | Aprobado: se cierra el pedido y se asigna la entrega. Si no: se cierra y se devuelve el stock               | Una transacción de DynamoDB en lugar de una sola actualización                  |
| Los importes se calculan solo en el servidor                                      | Un precio o total alterado en la petición se ignora                                                         | El cliente muestra un total que no es definitivo hasta que responde el servidor |
| Una clave de idempotencia por compra                                              | Un doble clic o una recarga no crean ni cobran dos veces                                                    | Un elemento marcador adicional por pedido                                       |
| Webhook con verificación de firma, idempotente y consulta de respaldo             | Un evento tardío o perdido igualmente cierra el pedido cuando el comprador consulta el estado               | Una llamada adicional al proveedor para pedidos que siguen `PENDING`            |
| `GET /deliveries/:id` no muestra destinatario, dirección ni teléfono              | El identificador de un pedido por sí solo no debe exponer datos personales                                  | Los datos de envío se leen de la tabla, no de la API                            |
| Una sola URL de CloudFront para la aplicación y `/api/*`                          | Mismo origen: CORS permanece cerrado y el navegador no llama a otro servidor                                | CloudFront queda delante de la API (2 proxies de confianza)                     |
| La Lambda se compila con `tsc` y no se empaqueta con un bundler                   | Nest necesita los metadatos de decoradores que esbuild elimina                                              | Paquete más grande (72 MB)                                                      |
| Los secretos están en SSM Parameter Store                                         | No hay datos sensibles en el código, en la plantilla ni en el entorno del repositorio                       | Una llamada adicional cuando arranca la Lambda                                  |

## Frontend

Rutas: `/` cafés, `/checkout/details` tarjeta y entrega (diálogo), `/checkout/summary` resumen (hoja inferior) y `/order/:id` resultado. Variables de compilación (ver `.env.example`): `VITE_API_URL`, `VITE_PAYMENT_API_URL` y `VITE_PAYMENT_PUBLIC_KEY`.

| Decisión                                                                                                              | Motivo                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La tarjeta va del navegador al servicio de pagos                                                                      | El número y el código no llegan a nuestros servidores, a Redux, a ninguna acción ni al almacenamiento                                                           |
| El borrador se guarda en `sessionStorage`, no en `localStorage`                                                       | Sobrevive a una recarga pero se elimina al cerrar la pestaña; contiene nombre, dirección y teléfono                                                             |
| Solo se guardan la selección y los datos; nunca un importe                                                            | Los precios vienen siempre de la API, así que editar el almacenamiento no puede mostrar un importe incorrecto                                                   |
| El `idempotencyKey` se guarda antes de enviar el pago                                                                 | Una recarga a mitad de la operación envía la misma clave, por lo que el pedido no se crea ni se cobra dos veces                                                 |
| El token de la tarjeta se conserva 30 minutos como máximo                                                             | Pasado ese tiempo se vuelve a pedir la tarjeta                                                                                                                  |
| La interfaz está en español (`lang="es"`)                                                                             | Los textos de la aplicación y los mensajes de error están en español neutro, con tuteo                                                                          |
| El nombre del destinatario es opcional                                                                                | Si está vacío, recibe el comprador; el formulario lo indica y el pedido siempre lleva un nombre                                                                 |
| Tras mostrar el resultado, la página vuelve a los cafés: en 8 s si el pago se aprueba y en 20 s si se rechaza o falla | La prueba pide volver a la página de productos. Se puede cancelar. Un rechazo da más tiempo para leer qué hacer y conserva los datos; una aprobación borra todo |
