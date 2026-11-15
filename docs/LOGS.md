# Logs

El backend escribe una línea JSON por evento en la salida estándar; Lambda la envía al grupo `/coffee-store/api` de CloudWatch Logs, donde cada campo se puede filtrar y contar. Se conservan 30 días.

## Campos comunes

| Campo       | Significado                                                                     |
| ----------- | ------------------------------------------------------------------------------- |
| `level`     | `info`, `warn` o `error`                                                        |
| `event`     | Nombre del evento, por ejemplo `order.settled`                                  |
| `time`      | Fecha y hora en ISO 8601                                                        |
| `requestId` | Identificador de la petición; también se devuelve en la cabecera `X-Request-Id` |

El mismo `requestId` aparece en todas las líneas de una petición, de modo que se puede seguir una compra de principio a fin.

## Eventos

| Evento                       | Nivel                            | Campos propios                                                     | Cuándo                                                      |
| ---------------------------- | -------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------- |
| `http.request`               | info, warn (4xx), error (5xx)    | `method`, `route`, `status`, `durationMs`                          | Termina una petición (no se registra `/health`)             |
| `checkout.reserved`          | info                             | `orderId`, `variantId`, `quantity`, `totalCents`                   | Se crea el pedido y se reserva el stock                     |
| `checkout.replayed`          | info                             | `orderId`, `status`                                                | Un reenvío con la misma clave recibe el primer pedido       |
| `checkout.rejected`          | warn                             | `reason` (y `variantId`, `quantity` si falta stock)                | Se rechaza un pedido                                        |
| `payment.charged`            | info, warn                       | `orderId`, `outcome`, `providerRef`                                | El proveedor responde al cobro                              |
| `order.settled`              | info                             | `orderId`, `status`, `source`, `stockReleased`, `deliveryAssigned` | El pedido pasa a su estado final                            |
| `order.settle_skipped`       | info                             | `orderId`, `wanted`, `current`, `source`                           | Otra vía ya lo había cerrado: no se repite nada             |
| `order.provider_unreachable` | warn                             | `orderId`                                                          | No se pudo preguntar al proveedor por un pedido pendiente   |
| `webhook.accepted`           | info                             | `orderId`, `status`                                                | Se acepta un evento firmado                                 |
| `webhook.rejected`           | warn                             | `reason`                                                           | Se rechaza un evento (firma, pedido o importe)              |
| `provider.call`              | info, warn (5xx o sin respuesta) | `operation`, `status` o `outcome`, `durationMs`                    | Una llamada al proveedor de pagos                           |
| `http.unhandled`             | error                            | `errorType`, `detail`, `stack`                                     | Falla algo inesperado (el cliente recibe un error genérico) |

`outcome` de `payment.charged` es `APPROVED`, `DECLINED`, `ERROR`, `PENDING`, `REJECTED` (el proveedor lo refusó) o `UNAVAILABLE` (resultado desconocido). `source` de `order.settled` es `charge`, `webhook`, `polling` o `expired`.

## Qué no se escribe

Nombre, correo, dirección, teléfono, token o número de tarjeta, claves, cuerpos de peticiones ni lo que el usuario haya escrito en una dirección. El adaptador solo admite textos, números y booleanos, y corta los textos a 500 caracteres. Un test de extremo a extremo recorre una compra completa y comprueba que ninguna línea contiene esos datos.

## Consultas (CloudWatch Logs Insights)

Se selecciona el grupo `/coffee-store/api` (el de la Lambda de la API; los despliegues anteriores a los logs estructurados usaban `/aws/lambda/CoffeeStoreApp-Api…`).

| Para saber…                         | Consulta                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| Qué pasó en una petición            | `fields @timestamp, event, level \| filter requestId = "<id>" \| sort @timestamp`                |
| Qué pasó con un pedido              | `fields @timestamp, event, status \| filter orderId = "<id>" \| sort @timestamp`                 |
| Pagos por resultado                 | `filter event = "payment.charged" \| stats count() by outcome`                                   |
| Tiempo de las llamadas al proveedor | `filter event = "provider.call" \| stats avg(durationMs), max(durationMs), count() by operation` |
| Peticiones lentas o fallidas        | `filter event = "http.request" and (status >= 500 or durationMs > 3000)`                         |
| Errores inesperados                 | `filter level = "error" \| sort @timestamp desc`                                                 |
| Eventos de webhook rechazados       | `filter event = "webhook.rejected" \| stats count() by reason`                                   |
