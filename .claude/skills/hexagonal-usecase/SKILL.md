---
name: hexagonal-usecase
description: "Trigger: new use case, backend feature, port, adapter, ROP, Result chaining. Scaffold a hexagonal use case with a port, adapter stub and Jest test."
license: Apache-2.0
metadata:
  author: "Alejandro5668"
  version: "1.0"
---

## Activation Contract

Load when adding or changing backend business logic in `backend/src`.

## Hard Rules

- `domain/` imports nothing from NestJS, the database or the payment provider.
- Use cases live in `application/`, depend only on ports, and return `Result<T, E>`; no scattered `try/catch`.
- Adapters live in `infrastructure/`; controllers in `interface/` only translate HTTP.
- Amounts are computed in the use case, never taken from the client.
- Write the Jest test first, with fake ports; no network or database.

## Decision Gates

| Need | Action |
|---|---|
| New external dependency | Define a port in `application/ports/`, adapter stub in `infrastructure/` |
| New failure mode | Add a typed error to the use case's `E` union and a test |
| Touches stock or payment | Also apply `adversarial-tests` |

## Execution Steps

1. Create the test from `assets/usecase.spec.template.ts`; observe it fail.
2. Create the port(s) and the use case from `assets/usecase.template.ts`, chaining steps with `andThen`.
3. Add the adapter stub and wire it in the Nest module.
4. Run `npm test -- --coverage` in `backend/`; keep coverage above 80 %.

## Output Contract

Return files created, the failure modes covered and the test result.

## References

- `assets/result.ts`, `assets/usecase.template.ts`, `assets/usecase.spec.template.ts`
- `docs/ACCEPTANCE_CRITERIA.md` (Checkout, API)
