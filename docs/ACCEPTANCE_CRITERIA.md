# Criterios de aceptación

Agrupados por el criterio de evaluación de la prueba. Cada casilla debe poder verificarse con una prueba, un comando o una URL pública.

## README (5 pts)

- [x] Modelo de datos, enlace a la documentación de la API (Swagger o Postman), resultados de cobertura y pasos de ejecución y despliegue.
- [x] Sección de decisiones y compromisos asumidos.

## UI/UX (5 pts)

- [x] Se puede usar desde 375 px de ancho sin desbordamientos.
- [x] Las imágenes cargan rápido (optimizadas y con carga diferida).

## Flujo de compra (20 pts)

- [x] La página de productos muestra descripción, precio y stock.
- [x] "Pay with credit card" abre un modal con los datos de la tarjeta y de la entrega.
- [x] La tarjeta se valida (Luhn, vencimiento y CVV) y se detectan los logotipos de Visa y Mastercard.
- [x] El resumen muestra producto, tarifa base y costo de envío en un panel superpuesto (backdrop).
- [x] El pago crea una transacción `PENDING`, llama al proveedor y luego actualiza la transacción, asigna la entrega y actualiza el stock.
- [x] Se muestra el estado final y después se redirige a la página de productos con el stock actualizado.
- [x] Si se recarga la página en cualquier paso, se recupera el progreso.

## API (20 pts)

- [x] `GET /products`, `POST /checkout`, `GET /transactions/:id` y `POST /webhooks/payments`.
- [x] Validación con los códigos HTTP correctos (400, 404, 409 y 422).
- [x] Los importes se calculan en el backend; los importes del cliente se ignoran.
- [x] Si dos clientes compran la última unidad a la vez, solo uno lo consigue.
- [x] Un pago fallido libera el stock.
- [ ] El webhook verifica su firma y es idempotente. _Pendiente: Implementado y probado; falta confirmar el checksum con un evento real del proveedor._

## Pruebas unitarias (30 pts)

- [x] Cobertura del backend superior al 80 % (Jest).
- [x] Cobertura del frontend superior al 80 % (Jest).
- [x] El umbral se exige en CI y los resultados se copian al README.

## Despliegue (20 pts)

- [x] Frontend en CloudFront con HTTPS.
- [x] API desplegada y conectada al frontend.
- [x] Infraestructura reproducible con un solo comando de CDK.
- [x] Una compra completa funciona en la URL pública.

## Bonificación

- [x] **Seguridad (5)**: cabeceras de seguridad, CORS restringido, HTTPS y ningún secreto en el repositorio.
- [ ] **Responsive (5)**: verificado en dos navegadores. _Pendiente: Solo verificado en Chrome._
- [x] **CSS (10)**: maquetación con flexbox y grid.
- [x] **Código limpio (10)**: reglas de lint y módulos pequeños.
- [x] **Hexagonal (10)**: el dominio no importa nada del framework, la base de datos ni el proveedor.
- [x] **ROP (10)**: los casos de uso encadenan pasos que devuelven éxito o error.

## Pruebas adversarias

Se intenta romper la aplicación a propósito. Cada caso es una prueba automatizada siempre que sea posible.

- [ ] Entradas maliciosas en los validadores (fuzzing o pruebas basadas en propiedades). _Pendiente: Hay listas de entradas maliciosas en los tests, pero no fuzzing ni pruebas basadas en propiedades._
- [x] Se rechazan precios alterados y cantidades negativas o excesivas.
- [x] Compras en paralelo con stock 1: el stock nunca queda negativo.
- [x] Un doble envío crea una sola transacción y un solo cobro.
- [x] Un webhook falsificado o reenviado no cambia nada.
- [x] Un tiempo de espera agotado, un error 5xx o una tarjeta rechazada del proveedor dejan un estado consistente.
- [x] Los payloads de inyección y XSS en los campos de entrega quedan neutralizados.
- [x] El número de tarjeta y el CVV no aparecen en logs, respuestas, Redux ni localStorage.
- [x] Editar localStorage o usar el botón de retroceso nunca muestra un importe incorrecto.
- [x] Los payloads demasiado grandes y las ráfagas de peticiones devuelven 413 o 429.
- [x] Mozilla Observatory y la prueba base de OWASP ZAP no muestran hallazgos de severidad alta.

## Reglas del repositorio

- [ ] Repositorio público, sin el nombre de la empresa, con commits distribuidos en el tiempo y un pull request por funcionalidad. _Pendiente: Cumple todo salvo la distribución: los commits abarcan 2 días._
