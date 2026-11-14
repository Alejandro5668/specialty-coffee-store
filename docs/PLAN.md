# Plan

Tienda de café de especialidad. Flujo: **Página de productos → Tarjeta y entrega → Resumen → Estado final → Página de productos**.
Los criterios de aceptación están en [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md).

## Tecnologías

| Capa          | Elección                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Frontend      | React + Redux Toolkit + TypeScript, diseñado primero para móvil                                                                      |
| Backend       | NestJS + TypeScript, arquitectura hexagonal y Railway Oriented Programming (ROP)                                                     |
| Base de datos | DynamoDB (decidido): cualquier base de datos está permitida; no se necesitan joins; actualizaciones condicionales atómicas del stock |
| Pruebas       | Jest, con más del 80 % de cobertura en frontend y backend                                                                            |
| Nube          | S3 + CloudFront y Lambda + API Gateway, definidos con AWS CDK; todos los recursos regionales en `us-east-2`                          |

## Decisiones principales

| Decisión                                                                         | Motivo                                                                |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Reservar el stock al crear la transacción `PENDING` y liberarlo si el pago falla | Evita vender más unidades de las que hay                              |
| Webhook idempotente y consulta del estado como respaldo                          | Resiste una caída entre el cobro y la actualización                   |
| Los importes se calculan siempre en el backend                                   | El cliente puede ser manipulado                                       |
| Los datos de la tarjeta no se guardan; solo se usa el token del proveedor        | Menor superficie de riesgo                                            |
| Despliegue sin servidores (serverless)                                           | Menos componentes que con contenedores y un servidor de base de datos |

## Fases

1. **Estructura y CI**: monorepo, lint, pruebas y cobertura en cada pull request.
2. **Dominio y datos iniciales**: entidades y 6 cafés con 2 tamaños cada uno.
3. **Casos de uso**: la compra como una cadena de pasos que devuelve éxito o error.
4. **Integración con el proveedor**: solo sandbox y webhook firmado. Flujo en [PAYMENTS.md](PAYMENTS.md).
5. **API**: productos, compra, estado del pedido, entregas y webhook, documentados con Swagger.
6. **Frontend**: cinco pantallas, con el estado recuperado tras una recarga.
7. **Pruebas**: cobertura superior al 80 % y casos adversarios.
8. **Despliegue**: un solo comando con CDK.
9. **README**: modelo de datos, documentación de la API, cobertura y decisiones.

Una rama y un pull request por funcionalidad, con commits convencionales.
