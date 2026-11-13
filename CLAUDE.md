# Project rules

Specialty coffee store. Read `docs/PLAN.md` and `docs/ACCEPTANCE_CRITERIA.md` before working.
Every change must serve an acceptance criterion; do not add features that are not asked for.

## Stack
- Frontend: React + Redux Toolkit + TypeScript, mobile first (375 px minimum).
- Backend: NestJS + TypeScript. Tests: Jest on both sides, coverage above 80 %.
- Infrastructure: AWS CDK (S3 + CloudFront, Lambda + API Gateway, DynamoDB).

## Architecture (backend)
- Hexagonal: `domain/` -> `application/` -> `infrastructure/` and `interface/`.
- `domain/` imports nothing from the framework, the database or the payment provider.
- Controllers only translate HTTP; business logic lives in use cases.
- Use cases follow Railway Oriented Programming: each step returns a `Result`, no scattered `try/catch`.
- External systems (database, payment provider) are reached through ports; adapters live in `infrastructure/`.
- Amounts are always computed in the backend. Never trust client values.
- Stock is reserved atomically when the PENDING transaction is created and released on failure.
- Webhooks verify their signature and are idempotent.

## Architecture (frontend)
- State in Redux; keep persisted state non-sensitive and recoverable after a refresh.
- Presentational components receive props; containers connect to the store.
- Never store or log the card number or CVV.

## Security
- Sandbox only. Keys come from environment variables; never commit secrets.
- Keep `.env.example` updated. Use security headers and restricted CORS.

## Testing
- Write the test first when a runnable test exists; each rule gets its own test.
- Test through public interfaces. Use fake ports for external systems.
- Include adversarial cases listed in `docs/ACCEPTANCE_CRITERIA.md`.

## Language
- Code, comments, docs, commit titles and PR titles: **English**.
- PR descriptions: **Spanish**, clear and precise.
- The company name of the payment provider must never appear in the repository.

## Documentation
Applies to every document: README, `docs/`, code comments, Swagger descriptions and PR descriptions.
- **Precise, readable, short.** Say it once, with the fewest words that stay exact.
- Prefer tables, checklists and examples over paragraphs. Paragraphs: 3 sentences maximum.
- One topic per document; link instead of repeating. No history, motivation essays or filler.
- Concrete over vague: name the file, command, endpoint or number.
- Brevity never removes required content: the README must keep the data model, API docs link, coverage results, run/deploy steps and decisions.
- Update the README and docs in the same PR that changes behavior.
- Keep API docs (Swagger or Postman) in sync with the endpoints.

## Git and pull requests
- One branch and one PR per feature, from `main`. Branch names: `feat/...`, `fix/...`, `docs/...`, `test/...`, `chore/...`.
- Conventional Commits. Titles in English, imperative, under 72 characters, e.g. `feat: add checkout use case`.
- Commits are small and frequent; tests and docs travel with the code they cover.
- PR title follows the same format as commits. PR description in Spanish with: **Resumen**, **Cambios**, **Cómo probar**, **Criterios de aceptación cubiertos**.
- Never add AI attribution of any kind: no `Co-Authored-By`, no "Generated with" lines, no tool names or marks in commits, PRs, code or docs.
- Never push, merge or open a PR without the owner's approval.

## Project skills
- `.claude/skills/pr-writer`: PR title (English) and description (Spanish).
- `.claude/skills/hexagonal-usecase`: use case with ROP, port, adapter stub and test.
- `.claude/skills/adversarial-tests`: attack-style tests for endpoints and use cases.
