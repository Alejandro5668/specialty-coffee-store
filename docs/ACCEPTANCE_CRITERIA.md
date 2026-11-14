# Criterios de aceptación

Agrupados por el criterio de evaluación de la prueba. Cada casilla debe poder verificarse con una prueba, un comando o una URL pública.

## README (5 pts)

- [ ] Modelo de datos, enlace a la documentación de la API (Swagger o Postman), resultados de cobertura y pasos de ejecución y despliegue.
- [ ] Sección de decisiones y compromisos asumidos.

## UI/UX (5 pts)

- [ ] Se puede usar desde 375 px de ancho sin desbordamientos.
- [ ] Las imágenes cargan rápido (optimizadas y con carga diferida).

## Flujo de compra (20 pts)

- [ ] La página de productos muestra descripción, precio y stock.
- [ ] "Pay with credit card" abre un modal con los datos de la tarjeta y de la entrega.
- [ ] La tarjeta se valida (Luhn, vencimiento y CVV) y se detectan los logotipos de Visa y Mastercard.
- [ ] El resumen muestra producto, tarifa base y costo de envío en un panel superpuesto (backdrop).
- [ ] El pago crea una transacción `PENDING`, llama al proveedor y luego actualiza la transacción, asigna la entrega y actualiza el stock.
- [ ] Se muestra el estado final y después se redirige a la página de productos con el stock actualizado.
- [ ] Si se recarga la página en cualquier paso, se recupera el progreso.

## API (20 pts)

- [ ] `GET /products`, `POST /checkout`, `GET /transactions/:id` y `POST /webhooks/payments`.
- [ ] Validación con los códigos HTTP correctos (400, 404, 409 y 422).
- [ ] Los importes se calculan en el backend; los importes del cliente se ignoran.
- [ ] Si dos clientes compran la última unidad a la vez, solo uno lo consigue.
- [ ] Un pago fallido libera el stock.
- [ ] El webhook verifica su firma y es idempotente.

## Pruebas unitarias (30 pts)

- [ ] Cobertura del backend superior al 80 % (Jest).
- [ ] Cobertura del frontend superior al 80 % (Jest).
- [ ] El umbral se exige en CI y los resultados se copian al README.

## Despliegue (20 pts)

- [ ] Frontend en CloudFront con HTTPS.
- [ ] API desplegada y conectada al frontend.
- [ ] Infraestructura reproducible con un solo comando de CDK.
- [ ] Una compra completa funciona en la URL pública.

## Bonificación

- [ ] **Seguridad (5)**: cabeceras de seguridad, CORS restringido, HTTPS y ningún secreto en el repositorio.
- [ ] **Responsive (5)**: verificado en dos navegadores.
- [ ] **CSS (10)**: maquetación con flexbox y grid.
- [ ] **Código limpio (10)**: reglas de lint y módulos pequeños.
- [ ] **Hexagonal (10)**: el dominio no importa nada del framework, la base de datos ni el proveedor.
- [ ] **ROP (10)**: los casos de uso encadenan pasos que devuelven éxito o error.

## Pruebas adversarias

Se intenta romper la aplicación a propósito. Cada caso es una prueba automatizada siempre que sea posible.

- [ ] Entradas maliciosas en los validadores (fuzzing o pruebas basadas en propiedades).
- [ ] Se rechazan precios alterados y cantidades negativas o excesivas.
- [ ] Compras en paralelo con stock 1: el stock nunca queda negativo.
- [ ] Un doble envío crea una sola transacción y un solo cobro.
- [ ] Un webhook falsificado o reenviado no cambia nada.
- [ ] Un tiempo de espera agotado, un error 5xx o una tarjeta rechazada del proveedor dejan un estado consistente.
- [ ] Los payloads de inyección y XSS en los campos de entrega quedan neutralizados.
- [ ] El número de tarjeta y el CVV no aparecen en logs, respuestas, Redux ni localStorage.
- [ ] Editar localStorage o usar el botón de retroceso nunca muestra un importe incorrecto.
- [ ] Los payloads demasiado grandes y las ráfagas de peticiones devuelven 413 o 429.
- [ ] Mozilla Observatory y la prueba base de OWASP ZAP no muestran hallazgos de severidad alta.

## Reglas del repositorio

- [ ] Repositorio público, sin el nombre de la empresa, con commits distribuidos en el tiempo y un pull request por funcionalidad.
