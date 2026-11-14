# Specialty Coffee Store

Checkout flow for a specialty coffee shop. Plan: [docs/PLAN.md](docs/PLAN.md). Criteria: [docs/ACCEPTANCE_CRITERIA.md](docs/ACCEPTANCE_CRITERIA.md).

## Requirements

Node 22 (`.nvmrc`), npm 10.

## Commands

| Command                                 | Action                                           |
| --------------------------------------- | ------------------------------------------------ |
| `npm ci`                                | Install all workspaces                           |
| `npm run lint` / `npm run format:check` | ESLint / Prettier                                |
| `npm run test:cov`                      | Jest with an 80 % coverage minimum               |
| `npm run build`                         | Build backend and frontend                       |
| `npm run start:dev -w backend`          | API on `:3000`, Swagger at `/docs`               |
| `npm run dev -w frontend`               | SPA on `:5173`                                   |
| `npm run seed -w backend`               | Load the 6 coffees into DynamoDB (safe to rerun) |
| `npm run openapi -w backend`            | Regenerate `docs/openapi.json`                   |

Copy `.env.example` to `.env`, fill it locally and export it before `start:dev`. Never commit it. DynamoDB needs AWS credentials.

## API

Swagger UI at `/docs` on the running API; spec in [docs/openapi.json](docs/openapi.json). A test fails if the spec drifts from the code.

| Endpoint                  | Purpose                                      | Errors                       |
| ------------------------- | -------------------------------------------- | ---------------------------- |
| `GET /products`           | Coffees with sizes, prices and stock         | 429                          |
| `POST /checkout`          | Reserve stock, create the order, charge      | 400, 404, 409, 413, 422, 429 |
| `GET /transactions/:id`   | Order status; asks the provider if `PENDING` | 404, 429                     |
| `POST /webhooks/payments` | Signed payment event (idempotent)            | 400, 401, 404, 413, 422      |

Limits: 16 KB bodies, 60 requests per minute per client (10 for checkout), CORS only for `CORS_ORIGIN`. Payment flow: [docs/PAYMENTS.md](docs/PAYMENTS.md).
