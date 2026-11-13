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

## UI/UX

Work backwards from the user: decide what they need to see, do and feel, then build what delivers it.

- Per screen or component, state first: who the user is, what they want, what can go wrong.
- Design every state: loading, empty, error, success, disabled.
- Errors say what happened and how to fix it, in plain words. Never show technical messages.
- Every action gives feedback; no double submit; progress survives a refresh.
- Mobile first (375 px): no overflow, touch targets of 44 px or more, readable contrast.
- Accessible: labels, visible focus, keyboard navigation, ARIA where needed.
- Check each change at 375 px before calling it done.

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

<!-- BEGIN AWS Agent Toolkit rules -->

# AWS Guidance for the new AWS experience

This user has signed up for the new AWS experience. This experience lets you sign into AWS using a social provider and requires the following additional context.

Where this guidance conflicts with the project's own instructions, the project's instructions take precedence.

## Context

### Terminology:

- Say "project" instead of "account" — a project contains an AWS account and settings for sharing with other collaborators
- Say "team member" instead of "IAM user" — users are invited by email, not created or federated in IAM
- Say "AWS Settings" when referring to management tasks at [settings.aws.com](https://settings.aws.com/) (project management, billing, team members, spend limits). Users view their actual AWS resources in the AWS Management Console.
- Say "selected Region" when referring to the user's Region — not "home Region"
- The user has a managed IAM experience. This includes a managed service control policies (SCP) and resource control policies (RCP) that govern the use of AWS. They will still need to use IAM to create policies to let services work with each other. If there are questions about the SCPs or RCPs, go to the documentation at https://docs.aws.amazon.com/accounts/latest/reference/scps-and-rcps-for-projects.html

### Constraints:

- All projects share a single AWS Region determined by the user's contact address. Resources cannot be created in other Regions
- When developing:
  - MUST create all Regional resources in the project's assigned Region
  - You CAN create AWS WAF and Cloudwatch Logs resources in us-east-1 when there are global resources (like a global WAF instance) that require a connection to dependencies in us-east-1. You should not use these for any other reason, because resources in the selected Region will provide lower cost (due to no cross-Region traffic), increased availability (due to no cross-Region traffic), and easier manageability (due to not needing to look in another Region). When you need to do an inventory of resources, you need to look in both the selected Region and us-east-1 for Cloudwatch Logs or WAF resources.
  - MUST NOT attempt to create Lambda, API Gateway, or other Regional resources in any other Region
  - MUST direct users to confirm their Region in AWS Settings > View all projects > Overview > Additional Info > Region. If the user cannot confirm their Region, check in ~/.aws/config
  - MUST NOT use Lambda@Edge — excluded from both Lambda and CloudFront
  - MUST NOT use CloudFormation StackSets — no multi-account or multi-Region deployments
  - MUST NOT attempt cross-Region actions — no cross-Region replication for DynamoDB/S3/RDS, no multi-Region KMS keys
  - MUST NOT use Route 53 cross-Region routing — geolocation, latency-based, and failover routing policies are not available
  - CloudFront is a global service and its actions ARE allowed in `us-east-1`. A user can create a CloudFront distribution pointing to their project-region Lambda function URL or API Gateway. However, Lambda and API Gateway themselves MUST NOT be created in `us-east-1` — they must be in the project Region.
  - Reduced availability in `eu-north-1` specifically: Amazon Rekognition, Amazon Textract, Amazon Personalize, AWS App Runner are not available in that Region.
- IAM permissions for human access are managed by AWS. Don't assign roles to team members unless absolutely necessary
- The user may have a spend limit if they are on the paid plan. The limit that pauses their project if it's exceeded. If resources suddenly become inaccessible, ask if they have a spend limit configured. Only project owners can modify a spend limit.
- When developing:
  - MUST ask about spend limit status if the user reports sudden "Access Denied" errors on operations that previously worked
  - MUST direct users to check spend status in AWS Settings > Billing
  - MUST check if a user has upgraded their account to the paid plan
  - MUST ask the user if they want to clean up the successfully created resources or keep them to reduce cost
- The user sets up billing, creates spend limits, and retrieves and pays invoices in AWS Settings. The user creates budgets and optimizes their costs in the AWS Billing and Cost Management console
- Not all AWS services are available. If a service isn't working, do the following:
  1. Run the command `aws freetier get-account-plan-state`
  2. If accountPlanType": "FREE", check the [Free Tier supported services list](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html#supported-services-free-tier) next,
  3. If accountPlanType": "PAID", check the [Paid Tier supported services list](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html#supported-services-paid-plan).
  4. If neither list shows the service, check the [Not supported for this experience list](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html#unsupported-services). The user will need to activate advanced features to access this service.
- Users can activate advanced AWS services and capabilities for their account.
- For any AWS task or question — building, configuring, migrating, debugging, or operating a service, writing SDK code, authoring CDK/CloudFormation, or answering how a service works — first call `aws___search_documentation` with topic `agent_skills` and load the matching skill with `aws___retrieve_skill`. Do this even when you believe you know the answer: skills carry current service behavior that your training may not. Prefer the skill's guidance over general knowledge. Skip it only for work that does not involve AWS.

### Help level

- help_level (required): LOW, MEDIUM, or HIGH. While a user is building, you MUST ask the user: "How much guidance would you like from me? Low (I only flag security risks), medium (I ask a couple of clarifying questions if something seems off), or high (I explain what I'm doing, suggest alternatives, and flag best practices)."

You CAN update this rule file to save a user's help_level.

Constraints for each level:

**LOW:**

- MUST follow all constraints in this context file
- MUST execute the user’s request without modification
- MUST NOT ask clarifying questions unless the action would create a security vulnerability
- MUST NOT suggest alternatives or improvements

**MEDIUM:**

- MUST execute the user's request
- MAY ask up to two clarifying questions per task if the request has an ambiguity or a potential issue
- MUST NOT repeat a question or suggestion the user has already dismissed
- MUST NOT explain trade-offs or alternatives unless the user asks

**HIGH:**

- MUST explain what each step does and why before executing it
- MUST suggest alternatives when a better approach exists
- MUST flag best practices and explain trade-offs
- MUST still execute the user's choice if they disagree with a suggestion

<!-- END AWS Agent Toolkit rules -->
