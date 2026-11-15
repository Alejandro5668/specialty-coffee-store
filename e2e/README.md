# Pruebas de extremo a extremo

Playwright maneja un Chrome móvil y un Firefox con el tamaño de un iPhone SE (375 × 667 px) y recorre la compra completa. Ejecutan el frontend real; el backend y el servicio de pagos se simulan.

## Comandos

| Comando                                           | Acción                                                                 |
| ------------------------------------------------- | ---------------------------------------------------------------------- |
| `npm test -w e2e`                                 | Suite en Chrome móvil. Levanta el frontend en `:5174`                  |
| `npm run test:browsers -w e2e`                    | Chrome móvil y Firefox: lo que ejecuta CI                              |
| `npm run test:all -w e2e`                         | Además, Chrome de escritorio                                           |
| `npm run test:live -w e2e`                        | Comprobaciones sobre el sitio desplegado, sin comprar ni guardar datos |
| `E2E_BASE_URL=https://… npm run test:live -w e2e` | Lo mismo contra otro despliegue                                        |
| `npm run report -w e2e`                           | Abre el informe HTML de la última ejecución                            |

Requisitos: Chrome instalado y `npm ci` en la raíz. CI instala Firefox del servidor oficial de Playwright, con la versión fijada en `package-lock.json`. Para Firefox, una sola vez: `npx playwright install firefox` (descarga unos 320 MB con FFmpeg en `~/.cache/ms-playwright`).

## Qué cubre

| Archivo                             | Casos                                                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `purchase.spec.ts`                  | Pago aprobado, rechazado, fallo del proveedor y pago que tarda en confirmarse; stock devuelto o reservado           |
| `form.spec.ts`                      | Campos obligatorios y opcionales, mensajes de error, logotipo Visa y Mastercard, tarjeta rechazada, Cerrar y Escape |
| `layout.spec.ts`                    | En cada pantalla: sin desplazamiento horizontal, controles de 44 px o más, textos en español, imágenes diferidas    |
| `recovery.spec.ts`                  | Recarga en cada paso, botón Atrás, `sessionStorage` manipulado, la tarjeta nunca se guarda                          |
| `adversarial-double-submit.spec.ts` | Doble clic, dos clics simultáneos, recarga a mitad del pago, conexión caída, última unidad, límite de peticiones    |
| `adversarial-hostile-input.spec.ts` | XSS, cadenas de inyección y cantidad fuera de rango                                                                 |
| `adversarial-card-data.spec.ts`     | El número y el código solo llegan al servicio de pagos: ni a nuestra API, ni a terceros, ni al almacenamiento       |
| `adversarial-time.spec.ts`          | Regreso automático a los cafés, botón "Quedarme en esta página" y catálogo lento                                    |
| `browser.spec.ts`                   | Confirma qué navegador y qué ancho de pantalla corrió cada proyecto                                                 |
| `live.spec.ts`                      | Sitio desplegado: contrato de la API, errores en español, cabeceras de seguridad, formulario vacío en móvil         |

## Cómo funciona

- `support/fake-backend.ts` simula nuestra API y el servicio de pagos con el mismo contrato que `docs/openapi.json`: el servidor calcula los importes, una clave de idempotencia repetida devuelve el mismo pedido, el stock se reserva al pagar y se devuelve si falla. La tarjeta decide el resultado como en el sandbox: `4242…` aprueba y `4111…` rechaza.
- `live.spec.ts` verifica ese mismo contrato sobre el sitio real, para detectar si el simulador se desvía. No compra ni escribe datos, pero envía peticiones que el servidor debe rechazar (cuerpo inválido, cuerpo grande y evento sin firma válida) y cuenta contra el límite de peticiones. Se ejecuta a mano después de cada despliegue y supone el catálogo inicial de 6 cafés.
- No se guardan trazas, vídeos ni capturas: los formularios contienen datos de tarjeta de prueba. Los números usados son los publicados para el sandbox; no son tarjetas reales.

## Límites

- La compra real sobre la URL pública se hace a mano con una tarjeta de prueba: no se escriben datos de tarjeta en un sitio desplegado desde estas pruebas.
- Chrome (móvil emulado y escritorio) y Firefox. Firefox no puede emular un teléfono: se prueba con el mismo tamaño de pantalla (375 × 667 px) y entrada táctil, no en un dispositivo real. Safari no está cubierto: Playwright usa WebKit, que habría que descargar aparte.
