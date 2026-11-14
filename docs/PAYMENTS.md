# Payments flow

Verified against the provider docs and the sandbox on 2026-11-13, except the webhook checksum (see [Webhook](#webhook)). Sandbox only. Keys come from `.env` (see `.env.example`); base URL is `PAYMENT_API_URL`.

## Flow

| #   | Who      | Call                               | Key              | Notes                                                                                                                       |
| --- | -------- | ---------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1   | Frontend | `GET /merchants/info`              | public (header)  | Header `x-merchant-public-key`. Returns both contracts and their tokens. Single use: fetch again for every attempt.         |
| 2   | Frontend | show `permalink` of both contracts | -                | The user must accept each one.                                                                                              |
| 3   | Frontend | `POST /tokens/cards`               | public (Bearer)  | The card goes browser → provider, never through our API.                                                                    |
| 4   | Frontend | `POST /checkout` (ours)            | -                | Sends card token, both acceptance tokens, `idempotencyKey`, variant, quantity, customer, delivery. Never amounts.           |
| 5   | Backend  | `POST /transactions`               | private (Bearer) | Returns 201 with `PENDING`. A 4xx marks the transaction `ERROR`; a timeout or 5xx keeps it `PENDING`.                       |
| 6   | Provider | `POST /webhooks/payments` (ours)   | events secret    | Final status. Must answer 200.                                                                                              |
| 7   | Backend  | `GET /transactions/:id`            | private (Bearer) | Fallback when the webhook is late or lost. A `PENDING` transaction unknown to the provider becomes `ERROR` after 5 minutes. |

## Rules found in the sandbox

| Rule                                                                                | Consequence                                                              |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| The acceptance token is single use (422 on reuse).                                  | Fetch a fresh one for every payment attempt.                             |
| `reference` must be unique (422 on reuse).                                          | Send our transaction id; the provider's own id is kept as `providerRef`. |
| `amount_in_cents` is an integer; currency is only `COP`.                            | Matches our Money type.                                                  |
| Minimum amount is 1,500 COP.                                                        | Never applies: the two fees alone are 11,000 COP.                        |
| A new transaction is always `PENDING`, then `APPROVED`/`DECLINED`/`ERROR`/`VOIDED`. | Stock is reserved before the call.                                       |
| A card token expires after about 2 days; the docs say to use it at most twice.      | Tokenize per attempt and use each token once.                            |
| `accept_personal_auth` was optional in the sandbox; the docs disagree.              | Always send it.                                                          |

## Integrity signature

`signature = SHA256(reference + amount_in_cents + currency + integrity_secret)`, lowercase hex, no separators. Computed in the backend only. A wrong value returns 422.

## Webhook

| Item     | Value                                                                                                     |
| -------- | --------------------------------------------------------------------------------------------------------- |
| Event    | `transaction.updated`                                                                                     |
| Body     | `event`, `data.transaction`, `signature.properties`, `signature.checksum`, `timestamp`, `sent_at`         |
| Checksum | `SHA256(values of signature.properties in order + timestamp + events_secret)`; also in `X-Event-Checksum` |
| Retries  | After 30 min, 3 h and 24 h on any non-200                                                                 |

**Unverified:** the docs example does not reproduce with this formula. Confirm with a real event once the API is public. Compare the checksum case-insensitively.

## Test cards

| Number                | Result                          |
| --------------------- | ------------------------------- |
| `4242 4242 4242 4242` | `APPROVED`                      |
| `4111 1111 1111 1111` | `DECLINED`                      |
| Any other             | Rejected at tokenization (422). |

Any future expiry and a 3-digit CVC. `ERROR`, timeouts and 5xx cannot be triggered with a card: tests cover them with a fake payment port (an in-memory stand-in for the provider).

## Open items

- Webhook checksum against a real event.
- Encrypted tokenization (the sandbox accepts plain).
