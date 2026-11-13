---
name: adversarial-tests
description: "Trigger: adversarial testing, break the app, fuzzing, abuse cases, security tests, negative tests. Generate attack-style tests for an endpoint or use case."
license: Apache-2.0
metadata:
  author: "Alejandro5668"
  version: "1.0"
---

## Activation Contract

Load when a use case or endpoint touches checkout, stock, payments, webhooks or user input, or when asked to try to break the app.

## Hard Rules

- Every case is an automated Jest test asserting the observable effect (status code, persisted data, stock).
- Sandbox and fake ports only; never call the real provider.
- A failing adversarial test means fix the app, never weaken the test.
- Tests must not print or store card numbers or CVV.

## Decision Gates

| Target | Cases to select from `references/cases.md` |
|---|---|
| POST /checkout | Tampered amounts, quantities, double submit, concurrency, provider failures |
| POST /webhooks/payments | Forged signature, replay, out-of-order events |
| Any input field | Fuzzing, injection, XSS, oversized payload |
| Frontend | Edited localStorage, refresh per step, back button |

## Execution Steps

1. Identify the target and pick matching cases.
2. Write one test per case with the expected safe outcome.
3. Run them; report which ones fail and why.
4. Mark covered items in `docs/ACCEPTANCE_CRITERIA.md` only after they pass.

## Output Contract

Return a table: case, test file, result (pass/fail), and any bug found.

## References

- `references/cases.md`
- `docs/ACCEPTANCE_CRITERIA.md` (Adversarial testing)
