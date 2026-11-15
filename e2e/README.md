# Pruebas de extremo a extremo

Playwright maneja un Chrome real con el tamaño de un iPhone SE (375 × 667 px) y recorre la compra completa. Ejecutan el frontend real; el backend y el servicio de pagos se simulan.

## Comandos

| Comando                                           | Acción                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| `npm test -w e2e`                                 | Suite completa en móvil (46 casos). Levanta el frontend en `:5174` |
| `npm run test:all -w e2e`                         | Móvil y escritorio (92 casos)                                      |
| `npm run test:live -w e2e`                        | Comprobaciones de solo lectura sobre el sitio desplegado (5 casos) |
| `E2E_BASE_URL=https://… npm run test:live -w e2e` | Lo mismo contra otro despliegue                                    |
| `npm run report -w e2e`                           | Abre el informe HTML de la última ejecución                        |

Requisitos: Chrome instalado (no se descarga ningún navegador) y `npm ci` en la raíz.

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
| `live.spec.ts`                      | Sitio desplegado: contrato de la API, errores en español, cabeceras de seguridad, formulario vacío en móvil         |

## Cómo funciona

- `support/fake-backend.ts` simula nuestra API y el servicio de pagos con el mismo contrato que `docs/openapi.json`: el servidor calcula los importes, una clave de idempotencia repetida devuelve el mismo pedido, el stock se reserva al pagar y se devuelve si falla. La tarjeta decide el resultado como en el sandbox: `4242…` aprueba y `4111…` rechaza.
- `live.spec.ts` verifica ese mismo contrato sobre el sitio real, para detectar si el simulador se desvía.
- No se guardan trazas, vídeos ni capturas: los formularios contienen datos de tarjeta de prueba. Los números usados son los publicados para el sandbox; no son tarjetas reales.

## Límites

- La compra real sobre la URL pública se hace a mano con una tarjeta de prueba: no se escriben datos de tarjeta en un sitio desplegado desde estas pruebas.
- Solo Chrome (escritorio y móvil emulado). Firefox y Safari requieren descargar sus navegadores.
