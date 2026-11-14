# Specialty Coffee Store

Checkout flow for a specialty coffee shop. Plan: [docs/PLAN.md](docs/PLAN.md). Criteria: [docs/ACCEPTANCE_CRITERIA.md](docs/ACCEPTANCE_CRITERIA.md).

## Requirements

Node 22 (`.nvmrc`), npm 10.

## Commands

| Command                                              | Action                                           |
| ---------------------------------------------------- | ------------------------------------------------ |
| `npm ci`                                             | Install all workspaces                           |
| `npm run lint` / `npm run format:check`              | ESLint / Prettier                                |
| `npm run test:cov`                                   | Jest with an 80 % coverage minimum               |
| `npm run build`                                      | Build backend and frontend                       |
| `npm run start:dev -w backend`                       | API on `:3000`, Swagger at `/docs`               |
| `npm run dev -w frontend`                            | SPA on `:5173`                                   |
| `npm run seed -w backend`                            | Load the 6 coffees into DynamoDB (safe to rerun) |
| `npm run openapi -w backend`                         | Regenerate `docs/openapi.json`                   |
| `npm run package:lambda -w backend`                  | Build `backend/build/lambda` (code + prod deps)  |
| `python3 frontend/scripts/generate-coffee-images.py` | Redraw the coffee images (needs Pillow)          |

Copy `.env.example` to `.env`, fill it locally and export it before `start:dev`. Never commit it. DynamoDB needs AWS credentials.

## API

Swagger UI at `/docs` on the running API; spec in [docs/openapi.json](docs/openapi.json). A test fails if the spec drifts from the code.

| Endpoint                  | Purpose                                      | Errors                       |
| ------------------------- | -------------------------------------------- | ---------------------------- |
| `GET /products`           | Coffees with sizes, prices and stock         | 429                          |
| `GET /checkout/options`   | Terms to accept (single use) and the fees    | 429, 503                     |
| `POST /checkout`          | Reserve stock, create the order, charge      | 400, 404, 409, 413, 422, 429 |
| `GET /transactions/:id`   | Order status; asks the provider if `PENDING` | 404, 429                     |
| `POST /webhooks/payments` | Signed payment event (idempotent)            | 400, 401, 404, 413, 422      |

Limits: 16 KB bodies, 60 requests per minute per client (10 for checkout), CORS only for `CORS_ORIGIN`. Payment flow: [docs/PAYMENTS.md](docs/PAYMENTS.md).

## Deploy

AWS CDK in `infra/`, region `us-east-2`. One CloudFront URL serves the SPA and `/api/*`, so the browser only calls its own origin and CORS stays closed.

| Piece             | Resource                                                                          |
| ----------------- | --------------------------------------------------------------------------------- |
| `CoffeeStoreData` | 4 DynamoDB tables, on demand; point-in-time recovery on orders                    |
| `CoffeeStoreApp`  | Lambda (Node 22, arm64) + HTTP API (50 req/s) + private S3 + CloudFront           |
| Secrets           | SSM SecureString `/coffee-store/payment-*`, read by the Lambda; never in the code |
| Edge              | Two CloudFront Functions: strip `/api`, send app routes to `index.html`           |

| Step | Command                                                                         |
| ---- | ------------------------------------------------------------------------------- |
| 1    | `aws login --profile coffee-store`, then `export AWS_PROFILE=coffee-store`      |
| 2    | `npx cdk bootstrap aws://<account>/us-east-2 -w infra` (once per account)       |
| 3    | Export `.env`, then `npm run secrets -w infra` (stores the 3 secrets in SSM)    |
| 4    | `npm run deploy -w infra` (package, build, deploy, seed); prints `SiteUrl`      |
| 5    | `npm run smoke -w infra -- <SiteUrl>`                                           |
| 6    | `npx cdk destroy --all -w infra` removes everything, tables and bucket included |

Limits: the default CloudFront certificate fixes the minimum TLS version; a custom domain is needed to raise it. `aws-cdk-lib` bundles a `minimatch` flagged by `npm audit`; it only runs on the developer machine at synth time.

## Frontend

Routes: `/` coffees, `/checkout/details` card and delivery (dialog), `/checkout/summary` summary (sheet), `/order/:id` result. Build-time variables (see `.env.example`): `VITE_API_URL`, `VITE_PAYMENT_API_URL`, `VITE_PAYMENT_PUBLIC_KEY`.

| Decision                                                  | Why                                                                                        |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| The card goes from the browser to the payment service     | The number and the code never reach our servers, Redux, an action or any storage           |
| The draft lives in `sessionStorage`, not `localStorage`   | It survives a refresh but is gone when the tab closes; it holds a name, address and phone  |
| Only the selection and details are saved; never an amount | Prices come from the API every time, so editing the storage cannot show a wrong amount     |
| The `idempotencyKey` is saved before the payment is sent  | A refresh in the middle sends the same key, so the order is never created or charged twice |
| The card token is kept 30 minutes at most                 | After that the card is asked again                                                         |
| The recipient name is optional                            | Empty means the buyer receives it; the form says so, and the order always carries a name   |
| After a result the page returns to the coffees in 8 s     | Cancelable. Declined or failed keeps the details; approved forgets everything              |
