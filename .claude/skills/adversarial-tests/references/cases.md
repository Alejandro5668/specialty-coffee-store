# Adversarial case catalog

| Case | Expected safe outcome |
|---|---|
| Fuzz validators (fast-check): card, amount, address | Never throws; invalid values rejected |
| Forged price, negative/zero/huge quantity, float rounding | 4xx; stored amount equals backend calculation |
| N parallel checkouts on stock 1 | Exactly one succeeds; stock never negative |
| Double submit / retry with same idempotency key | One transaction, one charge |
| Forged webhook signature | 401; no state change |
| Replayed webhook | No duplicate effects |
| Provider timeout, 5xx, malformed body, declined | Consistent final status; stock released |
| SQL/NoSQL injection and XSS in delivery fields | Sanitized input, escaped output |
| Card number or CVV in logs, responses, Redux, localStorage | None found |
| Edited localStorage, refresh at each step, back button | Recovers or fails safely; amount never wrong |
| Oversized body, request flood | 413 / 429 |
