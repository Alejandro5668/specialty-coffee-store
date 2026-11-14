# Specialty Coffee Store

Checkout flow for a specialty coffee shop. Plan: [docs/PLAN.md](docs/PLAN.md). Criteria: [docs/ACCEPTANCE_CRITERIA.md](docs/ACCEPTANCE_CRITERIA.md).

## Requirements

Node 22 (`.nvmrc`), npm 10.

## Commands

| Command                                 | Action                                           |
| --------------------------------------- | ------------------------------------------------ |
| `npm ci`                                | Install all workspaces                           |
| `npm run lint` / `npm run format:check` | ESLint / Prettier                                |
| `npm run test:cov`                      | Jest with an 80 % coverage minimum               |
| `npm run build`                         | Build backend and frontend                       |
| `npm run start:dev -w backend`          | API on `:3000` (`GET /health`)                   |
| `npm run dev -w frontend`               | SPA on `:5173`                                   |
| `npm run seed -w backend`               | Load the 6 coffees into DynamoDB (safe to rerun) |

Copy `.env.example` to `.env` and fill it locally. Never commit it.
