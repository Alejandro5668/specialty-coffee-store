# Plan

A specialty coffee store. Flow: **Product page → Card + delivery → Summary → Final status → Product page**.
Acceptance criteria live in [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md).

## Stack

| Layer | Choice |
|---|---|
| Frontend | React + Redux Toolkit + TypeScript (mobile first) |
| Backend | NestJS + TypeScript, hexagonal + Railway Oriented Programming |
| Database | DynamoDB (decided): any database is allowed; no JOINs needed; atomic conditional stock updates |
| Tests | Jest, above 80 % coverage on both sides |
| Cloud | S3 + CloudFront, Lambda + API Gateway, defined with AWS CDK; all regional resources in `us-east-2` |

## Key decisions

| Decision | Why |
|---|---|
| Reserve stock when the PENDING transaction is created; release it on failure | Prevents overselling |
| Idempotent webhook plus status check as fallback | Survives a crash between charge and update |
| Amounts always computed in the backend | The client can be tampered with |
| Card data never stored; only the provider token is used | Smaller risk surface |
| Serverless deployment | Fewer moving parts than containers and a database server |

## Phases

1. **Scaffold and CI**: monorepo, lint, tests and coverage on every PR.
2. **Domain and seed**: entities, 6 coffees with 2 sizes each.
3. **Use cases**: checkout as a chain of steps that returns success or error.
4. **Provider integration**: sandbox only, signed webhook.
5. **API**: four endpoints with Swagger or Postman.
6. **Frontend**: five screens, state recovered after a refresh.
7. **Tests**: coverage above 80 %, plus adversarial cases.
8. **Deploy**: one command with CDK.
9. **README**: data model, API docs, coverage, decisions.

One branch and one pull request per feature, with conventional commits.
