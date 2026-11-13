# Acceptance Criteria

Grouped by test rubric item. Each box must be verifiable by a test, a command or a public URL.

## README (5 pts)
- [ ] Data model, API docs link (Swagger or Postman), coverage results, run and deploy steps.
- [ ] Decisions and trade-offs section.

## UI/UX (5 pts)
- [ ] Usable from 375 px wide with no overflow.
- [ ] Images load fast (optimized, lazy loaded).

## Checkout flow (20 pts)
- [ ] Product page shows description, price and stock.
- [ ] "Pay with credit card" opens a modal with card and delivery data.
- [ ] Card validated (Luhn, expiry, CVV); Visa and Mastercard logos detected.
- [ ] Summary shows product + base fee + delivery fee in a backdrop.
- [ ] Payment creates a PENDING transaction, calls the provider, then updates the transaction, assigns the delivery and updates the stock.
- [ ] Final status is shown, then redirect to the product page with updated stock.
- [ ] Refreshing at any step recovers the progress.

## API (20 pts)
- [ ] `GET /products`, `POST /checkout`, `GET /transactions/:id`, `POST /webhooks/payments`.
- [ ] Validation with correct HTTP codes (400, 404, 409, 422).
- [ ] Amounts computed in the backend; client amounts ignored.
- [ ] Last unit bought by two clients at once: exactly one succeeds.
- [ ] Failed payment releases the stock.
- [ ] Webhook verifies its signature and is idempotent.

## Unit tests (30 pts)
- [ ] Backend coverage above 80 % (Jest).
- [ ] Frontend coverage above 80 % (Jest).
- [ ] Threshold enforced in CI; results copied to the README.

## Deployment (20 pts)
- [ ] Frontend on CloudFront over HTTPS.
- [ ] API deployed and connected to the frontend.
- [ ] Infrastructure reproducible with one CDK command.
- [ ] A full purchase works on the public URL.

## Bonus
- [ ] **Security (5)**: security headers, restricted CORS, HTTPS, no secrets in the repo.
- [ ] **Responsive (5)**: checked in two browsers.
- [ ] **CSS (10)**: flexbox and grid layout.
- [ ] **Clean code (10)**: lint rules, small modules.
- [ ] **Hexagonal (10)**: domain imports nothing from framework, database or provider.
- [ ] **ROP (10)**: use cases chain steps returning success or error.

## Adversarial testing
Try to break the app on purpose. Each case is an automated test where possible.
- [ ] Hostile inputs on validators (fuzzing or property-based).
- [ ] Forged prices, negative or huge quantities are rejected.
- [ ] Parallel purchases on stock 1: stock never goes negative.
- [ ] Double submit creates one transaction and one charge.
- [ ] Forged or replayed webhook changes nothing.
- [ ] Provider timeout, 5xx or declined card leaves a consistent state.
- [ ] Injection and XSS payloads in delivery fields are neutralized.
- [ ] No card number or CVV in logs, responses, Redux or localStorage.
- [ ] Edited localStorage or back button never shows a wrong amount.
- [ ] Oversized payloads and floods return 413 or 429.
- [ ] Mozilla Observatory and OWASP ZAP baseline show no high findings.

## Repository rules
- [ ] Public repo, no company name in it, commits spread over time, one PR per feature.
