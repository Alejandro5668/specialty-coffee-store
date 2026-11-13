# Execution Plan, Decisions and Acceptance Criteria

Specialty coffee store: product page, card + delivery modal, summary, payment, final status, product page.
Every acceptance criterion (AC) is verifiable by a test, a command or a public URL.

## 1. Decisions

| # | Decision | Discarded alternative | Reason |
|---|---|---|---|
| D1 | Specialty coffee with a size variant | Crafts, chocolate | Closed scope, naturally limited stock |
| D2 | React + Redux Toolkit + TypeScript | Vue + Vuex | Redux is mandatory; RTK cuts boilerplate |
| D3 | NestJS + TypeScript | Sinatra, Grape | One language, modules fit hexagonal |
| D4 | Hexagonal + Railway Oriented Programming | Classic layers | Testability and bonus points |
| D5 | Reserve stock on PENDING creation, release on failure | Decrement only on approval | Prevents overselling |
| D6 | Idempotent webhook + status polling fallback | Synchronous response only | Survives crashes between charge and update |
| D7 | No card data in backend or localStorage | Store encrypted | Smaller risk surface |
| D8 | Serverless: S3 + CloudFront, Lambda + API Gateway, AWS CDK | ECS + RDS | Fewer moving parts |
| D9 | DynamoDB (provisional, pending confirmation) | PostgreSQL on RDS | No VPC, atomic conditional updates |

## 2. Phases and acceptance criteria

### Phase 0: Scaffold and CI
- AC0.1 Monorepo with `backend/` and `frontend/`, each with a working `npm test`.
- AC0.2 GitHub Actions runs lint, tests and coverage on every PR.
- AC0.3 `.env.example` exists and no secret is present in git history.

### Phase 1: Domain and data
- AC1.1 Entities: Product, Variant, Customer, Delivery, Transaction.
- AC1.2 Seed with 6 coffees, 2 sizes each.
- AC1.3 Domain imports nothing from the framework, the database or the payment provider.

### Phase 2: Use cases (ROP)
- AC2.1 `CreateCheckout` returns a `Result` chaining: validate, reserve stock, create PENDING, charge, close.
- AC2.2 Insufficient stock returns an error and never triggers a charge.
- AC2.3 A failed payment leaves the transaction FAILED and releases the stock.
- AC2.4 Two simultaneous purchases of the last unit: exactly one succeeds.
- AC2.5 Amounts are computed in the backend; client-sent amounts are ignored.

### Phase 3: Payment provider integration (sandbox only)
- AC3.1 Charges run against the sandbox with keys from environment variables.
- AC3.2 The webhook verifies its signature and is idempotent.
- AC3.3 If the webhook never arrives, `GET /transactions/:id` reconciles the status.

### Phase 4: API
- AC4.1 `GET /products`, `POST /checkout`, `GET /transactions/:id`, `POST /webhooks/payments`.
- AC4.2 Input validation with correct HTTP codes (400, 404, 409, 422, 502).
- AC4.3 Swagger or Postman collection published and linked in the README.

### Phase 5: Frontend
- AC5.1 The five screens work end to end.
- AC5.2 Card validation (Luhn, expiry, CVV) and Visa/Mastercard logo detection.
- AC5.3 Summary with product + base fee + delivery fee in a backdrop component.
- AC5.4 Refreshing at any step recovers progress.
- AC5.5 Usable from 375 px wide without breaking the layout.
- AC5.6 Redux and localStorage hold non-sensitive data only.

### Phase 6: Unit tests
- AC6.1 Backend coverage above 80 % (Jest).
- AC6.2 Frontend coverage above 80 % (Jest).
- AC6.3 Coverage threshold enforced in CI; report copied to the README.

### Phase 7: Deployment
- AC7.1 Frontend served over HTTPS through CloudFront.
- AC7.2 API deployed and connected to the frontend.
- AC7.3 Infrastructure defined with CDK and reproducible with one command.
- AC7.4 A full purchase works on the public URL.

### Phase 8: README
- AC8.1 Data model, Swagger/Postman, coverage, run and deploy instructions.
- AC8.2 Decisions and trade-offs section.

## 3. Adversarial testing (transversal)

Goal: try to break the app on purpose. Each case becomes an automated test where possible.

| ID | Attack or failure | Acceptance criterion |
|---|---|---|
| AT1 | Hostile inputs on validators (property-based / fuzzing, e.g. fast-check) | Card, amount and address validators never throw unexpectedly and never accept invalid values |
| AT2 | Tampered payload: forged price, negative or zero quantity, huge quantity, rounding tricks | Rejected with 4xx; stored amounts always match backend calculation |
| AT3 | Concurrency: N parallel checkouts on stock 1 | Exactly one succeeds; stock never goes negative |
| AT4 | Duplicate submit (double click, retry) | Idempotency key prevents a second transaction or charge |
| AT5 | Forged or replayed webhook | Invalid signature gets 401 with no state change; replays change nothing |
| AT6 | Provider failures: timeout, 5xx, malformed body, declined card | Transaction ends in a consistent state and stock is released |
| AT7 | Injection and XSS payloads in delivery fields | Input sanitized, output escaped, no query injection |
| AT8 | Sensitive data leakage | Tests assert logs, responses, Redux and localStorage contain no card number or CVV |
| AT9 | Frontend abuse: refresh at each step, back button, offline, edited localStorage | App recovers or fails safely, never shows a wrong amount |
| AT10 | Oversized payloads and request floods | Payload limit and rate limiting return 413 / 429 |
| AT11 | Security scan of the deployed site | Mozilla Observatory and OWASP ZAP baseline run with no high findings |

## 4. Rubric traceability

| Rubric item | Points | Covered by |
|---|---|---|
| README | 5 | AC8.x |
| Fast images, no UI overflow | 5 | AC5.5, optimized images |
| Full checkout onboarding | 20 | Phases 2, 3, 5 and AT2 to AT6 |
| API working correctly | 20 | Phase 4 and AT2, AT5, AT10 |
| Coverage above 80 % | 30 | Phase 6 |
| Cloud deployment | 20 | Phase 7 |
| Bonus: OWASP, HTTPS, headers | 5 | Helmet, restricted CORS, CloudFront, AT7, AT11 |
| Bonus: responsive, browsers | 5 | AC5.5, manual check in two browsers |
| Bonus: CSS | 10 | Flexbox and grid layout |
| Bonus: clean code | 10 | Lint rules, small modules |
| Bonus: hexagonal | 10 | AC1.3 |
| Bonus: ROP | 10 | AC2.1 |

## 5. Risks

- Missing the 80 % target: CI threshold and use cases tested with fake ports.
- Sandbox unavailable: a fake `PaymentGateway` adapter for development and tests.
- AWS costs: budget alert; deploy only at the end.
- Fraud suspicion: small frequent commits, one branch and one PR per feature.
