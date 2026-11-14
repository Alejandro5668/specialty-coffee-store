# Flujo de pagos

Verificado contra la documentación del proveedor y su sandbox el 2026-11-14, salvo el checksum del webhook (ver [Webhook](#webhook)). Solo sandbox. Las claves se leen de `.env` (ver `.env.example`) y la URL base es `PAYMENT_API_URL`.

## Flujo

| #   | Quién     | Llamada                                   | Clave              | Notas                                                                                                                                    |
| --- | --------- | ----------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Backend   | `GET /merchants/info`                     | pública (cabecera) | La entrega al frontend `GET /checkout/options`, junto con las tarifas. Es de un solo uso: se consulta de nuevo en cada intento.          |
| 2   | Frontend  | mostrar el `permalink` de ambos contratos | -                  | El usuario debe aceptar cada uno.                                                                                                        |
| 3   | Frontend  | `POST /tokens/cards`                      | pública (Bearer)   | La tarjeta va del navegador al proveedor; nunca pasa por nuestra API.                                                                    |
| 4   | Frontend  | `POST /checkout` (nuestra API)            | -                  | Envía el token de la tarjeta, ambos tokens de aceptación, `idempotencyKey`, variante, cantidad, cliente y entrega. Nunca envía importes. |
| 5   | Backend   | `POST /transactions`                      | privada (Bearer)   | Responde 201 con `PENDING`. Un error 4xx marca la transacción como `ERROR`; un tiempo de espera agotado o un 5xx la deja en `PENDING`.   |
| 6   | Proveedor | `POST /webhooks/payments` (nuestra API)   | secreto de eventos | Estado final. Debe responder 200.                                                                                                        |
| 7   | Backend   | `GET /transactions/:id`                   | privada (Bearer)   | Respaldo cuando el webhook llega tarde o se pierde. Una transacción `PENDING` que el proveedor no conoce pasa a `ERROR` a los 5 minutos. |

## Reglas encontradas en el sandbox

| Regla                                                                                                                                                        | Consecuencia                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| El navegador no puede llamar a `GET /merchants/info`: la verificación previa (preflight) no devuelve cabeceras CORS. `POST /tokens/cards` sí está permitido. | El backend obtiene los tokens de aceptación (`GET /checkout/options`).                                  |
| El token de aceptación es de un solo uso (422 si se reutiliza).                                                                                              | Se obtiene uno nuevo en cada intento de pago.                                                           |
| `reference` debe ser única (422 si se repite).                                                                                                               | Se envía el id de nuestra transacción; el id del proveedor se guarda como `providerRef`.                |
| `amount_in_cents` es un entero y la moneda solo puede ser `COP`.                                                                                             | Coincide con nuestro tipo `Money`.                                                                      |
| El importe mínimo es 1.500 COP.                                                                                                                              | No se aplica: solo las dos tarifas suman 11.000 COP.                                                    |
| Una transacción nueva siempre es `PENDING` y después pasa a `APPROVED`, `DECLINED`, `ERROR` o `VOIDED`.                                                      | El stock se reserva antes de la llamada.                                                                |
| El proveedor no comprueba la fecha de vencimiento y exige un nombre del titular de 5 o más caracteres.                                                       | El formulario valida el vencimiento por sí mismo y pide 5 o más caracteres.                             |
| En el sandbox solo generan token las tarjetas `4242 4242 4242 4242` y `4111 1111 1111 1111`; las Mastercard de prueba se rechazan (422).                     | El formulario muestra el logotipo de Mastercard cuando la detecta; el sandbox la rechaza.               |
| El token de una tarjeta caduca a los 2 días aproximadamente; la documentación indica usarlo como máximo dos veces.                                           | Se genera un token por intento, se usa una sola vez y se conserva como máximo 30 minutos en la pestaña. |
| `accept_personal_auth` era opcional en el sandbox, pero la documentación dice lo contrario.                                                                  | Se envía siempre.                                                                                       |

## Firma de integridad

`signature = SHA256(reference + amount_in_cents + currency + integrity_secret)`, en hexadecimal minúsculas y sin separadores. Se calcula solo en el backend. Un valor incorrecto devuelve 422.

## Webhook

| Elemento   | Valor                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------- |
| Evento     | `transaction.updated`                                                                                               |
| Cuerpo     | `event`, `data.transaction`, `signature.properties`, `signature.checksum`, `timestamp`, `sent_at`                   |
| Checksum   | `SHA256(valores de signature.properties en orden + timestamp + events_secret)`; también llega en `X-Event-Checksum` |
| Reintentos | A los 30 minutos, a las 3 horas y a las 24 horas, ante cualquier respuesta distinta de 200                          |

**Sin verificar:** el ejemplo de la documentación no se reproduce con esta fórmula. No se confirmó con un evento real porque no se registró la URL del webhook: la cuenta del sandbox es compartida entre candidatos y registrarla reemplazaría la de otros y haría llegar eventos ajenos a esta API. Para confirmarla, registrar `/api/webhooks/payments` en una cuenta propia y leer en los logs de la Lambda `Webhook accepted` o `Webhook rejected: INVALID_SIGNATURE`. El checksum se compara sin distinguir mayúsculas de minúsculas. Las propiedades firmadas no incluyen `reference`, por lo que al cerrar un pago también se comprueba que el importe del evento sea igual al nuestro.

## Tarjetas de prueba

| Número                | Resultado                             |
| --------------------- | ------------------------------------- |
| `4242 4242 4242 4242` | `APPROVED`                            |
| `4111 1111 1111 1111` | `DECLINED`                            |
| Cualquier otra        | Se rechaza al generar el token (422). |

Cualquier vencimiento futuro y un CVC de 3 dígitos. `ERROR`, los tiempos de espera agotados y los 5xx no se pueden provocar con una tarjeta: las pruebas los cubren con un puerto de pago falso (una implementación en memoria que reemplaza al proveedor).

## Pendiente

- Verificar el checksum del webhook con un evento real (ver [Webhook](#webhook)). Mientras tanto, el estado final se obtiene consultando al proveedor (`GET /transactions/:id`).
- Tokenización cifrada (el sandbox acepta datos sin cifrar).
