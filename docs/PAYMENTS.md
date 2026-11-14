# Payments flow

Verified against the provider docs and the sandbox on 2026-11-13. Sandbox only. Keys come from `.env` (see `.env.example`); base URL is `PAYMENT_API_URL`.

## Flow

| #   | Who      | Call                               | Key              | Notes                                                                    |
| --- | -------- | ---------------------------------- | ---------------- | ------------------------------------------------------------------------ |
| 1   | Backend  | `GET /merchants/info`              | public (header)  | Header `x-merchant-public-key`. Returns both contracts and their tokens. |
| 2   | Frontend | show `permalink` of both contracts | -                | The user must accept each one.                                           |
| 3   | Frontend | `POST /tokens/cards`               | public (Bearer)  | The card goes browser → provider, never through our API.                 |
| 4   | Frontend | `POST /checkout` (ours)            | -                | Sends token, quantity, variant, delivery. Never amounts.                 |
| 5   | Backend  | `POST /transactions`               | private (Bearer) | Returns 201 with `PENDING`.                                              |
| 6   | Provider | `POST /webhooks/payments` (ours)   | events secret    | Final status. Must answer 200.                                           |
| 7   | Backend  | `GET /transactions/:id`            | private (Bearer) | Fallback when the webhook is late or lost.                               |

## Rules found in the sandbox

| Rule                                                                                | Consequence                                      |
| ----------------------------------------------------------------------------------- | ------------------------------------------------ |
| The acceptance token is single use (422 on reuse).                                  | Fetch a fresh one for every payment attempt.     |
| `reference` must be unique (422 on reuse).                                          | Use the transaction id.                          |
| `amount_in_cents` is an integer; currency is only `COP`.                            | Matches our Money type.                          |
| Minimum amount is 1,500 COP.                                                        | Always below our minimum total.                  |
| A new transaction is always `PENDING`, then `APPROVED`/`DECLINED`/`ERROR`/`VOIDED`. | Stock is reserved before the call.               |
| A card token is valid about 2 days.                                                 | Do not cache it; never reuse it more than twice. |
| `accept_personal_auth` was optional; send it anyway.                                | Docs disagree on whether it is required.         |

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

| Number                | Result                                                                        |
| --------------------- | ----------------------------------------------------------------------------- |
| `4242 4242 4242 4242` | `APPROVED`                                                                    |
| `4111 1111 1111 1111` | `DECLINED`                                                                    |
| Any other             | Rejected at tokenization (422); `ERROR` is not reproducible, use a fake port. |

Any future expiry and a 3-digit CVC.

## Open items

- Webhook checksum against a real event.
- Encrypted tokenization (the sandbox accepts plain).
