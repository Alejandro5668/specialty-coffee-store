# Specialty Coffee Store

Checkout flow for a specialty coffee shop. Plan: [docs/PLAN.md](docs/PLAN.md). Criteria: [docs/ACCEPTANCE_CRITERIA.md](docs/ACCEPTANCE_CRITERIA.md).

## Live

| What          | Where                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------- |
| App           | https://d2eds6bsugsp7t.cloudfront.net                                                                         |
| API docs      | https://d2eds6bsugsp7t.cloudfront.net/api/docs (Swagger UI), `/api/docs/openapi.json` (raw)                   |
| Test purchase | Card `4242 4242 4242 4242`, any future expiry, 3-digit code, a name of 5+ characters: the payment is approved |

Payments run in the provider's sandbox: no real money moves. The card `4111 1111 1111 1111` is declined.

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
| `GET /deliveries/:id`     | Delivery assigned to a paid order            | 404, 429                     |
| `POST /webhooks/payments` | Signed payment event (idempotent)            | 400, 401, 404, 413, 422      |

Limits: 16 KB bodies, 60 requests per minute per client (10 for checkout), CORS only for `CORS_ORIGIN`. Payment flow: [docs/PAYMENTS.md](docs/PAYMENTS.md).

## Data model

DynamoDB, one table per entity, on demand. Table names are `<TABLE_PREFIX>-<name>`.

| Table          | Key                  | Holds                                                                                                     |
| -------------- | -------------------- | --------------------------------------------------------------------------------------------------------- |
| `products`     | `id`                 | Name, description, image                                                                                  |
| `variants`     | `id`                 | `productId`, size in grams, price in cents, `stock` (changed only by conditional writes)                  |
| `customers`    | `email`              | `id`, name                                                                                                |
| `transactions` | `id`                 | Status, `customerId`, variant, quantity, amounts, delivery data, provider reference; `IDEM#<key>` markers |
| `deliveries`   | `id` (= transaction) | Customer, variant, quantity, recipient, address, city, phone, status `ASSIGNED`                           |

A payment is settled in one atomic write: approved, the transaction closes and its delivery is assigned; declined or failed, the transaction closes and the stock goes back. A delivery exists only for an approved payment.

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

## Tests

Jest in all three workspaces, run by CI on every pull request with an 80 % minimum (`coverageThreshold`).

| Workspace  | Tests | Statements | Branches | Functions | Lines   |
| ---------- | ----- | ---------- | -------- | --------- | ------- |
| `frontend` | 466   | 98.24 %    | 94.39 %  | 98.66 %   | 99.06 % |
| `backend`  | 510   | 98.92 %    | 94.25 %  | 99.42 %   | 99.73 % |
| `infra`    | 36    | 100 %      | 100 %    | 100 %     | 100 %   |

Backend tests use in-memory fakes of every port, so they need no network or AWS. Adversarial cases (forged amounts, floods, replayed webhooks, hostile ids, parallel purchases on the last unit) are automated.

## Backend decisions

| Decision                                                     | Why                                                                                         | Trade-off                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Hexagonal: `domain` imports no framework, DB or provider     | Business rules are tested without Nest, AWS or the network                                  | More files than a plain controller-to-DB service                  |
| Use cases return a `Result` (railway style)                  | Every failure is a value with a stable code; no scattered `try/catch`                       | Callers must unwrap; the HTTP layer does it in one place          |
| DynamoDB, one table per entity, on demand                    | No servers, nothing billed when idle, atomic conditional writes for stock                   | No joins: each entity is read by its key                          |
| Stock is reserved when the `PENDING` order is created        | Two buyers of the last unit cannot both succeed; a failed payment gives the unit back       | A stuck `PENDING` order holds stock until it is settled           |
| Settling is one atomic write                                 | Approved: close the order and assign the delivery. Otherwise: close it and return the stock | A DynamoDB transaction instead of a single update                 |
| Amounts are computed on the server only                      | A forged price or total in the request is ignored                                           | The client shows a total it cannot trust until the server answers |
| An idempotency key per purchase                              | A double click or a refresh never creates or charges twice                                  | One extra marker item per order                                   |
| Webhook: signature check, idempotent, plus a lookup fallback | A late or lost event still settles the order when the shopper polls                         | An extra provider call for orders left `PENDING`                  |
| `GET /deliveries/:id` hides recipient, address and phone     | An order id alone must not expose personal data                                             | Fulfilment data is read from the table, not from the API          |
| One CloudFront URL for the site and `/api/*`                 | Same origin: CORS stays closed and the browser never calls another host                     | CloudFront also sits in front of the API (2 trusted proxies)      |
| Lambda is compiled with `tsc`, not bundled                   | Nest needs the decorator metadata that esbuild drops                                        | A larger package (72 MB)                                          |
| Secrets live in SSM Parameter Store                          | Nothing sensitive in the code, the template or the environment of the repository            | One extra call when the Lambda starts                             |

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
