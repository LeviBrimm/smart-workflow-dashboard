# Smart Workflow Dashboard

[![CI](https://github.com/levibrimm/smart-workflow-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/levibrimm/smart-workflow-dashboard/actions/workflows/ci.yml)

smart workflow dashboard is my little automation lab. it’s a docker-compose stack where React + Tailwind talk to an Express/Node API, Postgres stores everything and Localstack fakes the AWS bits (Cognito, SQS, S3, SES). you spin it up, build workflows, fire webhooks or cron jobs and peek at every run without touching real cloud accounts

## highlights 

- **workflow builder with guardrails** – create or pause flows, edit steps, assign webhooks/schedules, and re-activate when ready
- **run log + control center** – list, select and cancel runs with a sticky detail drawer + toasts so you always know what happened
- **background muscles** – worker & scheduler containers chew through queues and cron ticks while Localstack mimics AWS
- **step library** – http/email/s3 steps plus slack + openai integrations. with template buttons so you’re not pasting JSON every time
- **ui polish without going wild** – light palette, badges, keyboard shortcuts and friendly copy where possible
- **tests that hit the real stack** – webhook + scheduler suites run against dockerized services, so CI mirrors reality

## What’s inside

- **api/** – TypeScript Express service with workflow CRUD, trigger management, webhook entry point, scheduler job, and SQS worker
- **client/** – Vite + React + React Query front‑end: workflow builder, run history, Cognito login, tokens persisted in localStorage
- **lambdas/** – Scheduler and worker handlers (share code with the API)
- **docker-compose.yml** – Boots Postgres, API, client (nginx), Localstack, SQS worker, and scheduler with one command
- **.github/workflows/ci.yml** – Lints/typechecks/tests the API and builds the client on every push/PR

```
smart-workflow-dashboard/
├── api/
├── client/
├── lambdas/
├── docs/
├── infra/
└── docker-compose.yml
```

## Prerequisites

- Node.js 20+
- Docker Desktop (for Postgres + Localstack)
- AWS CLI credentials **not** required; Localstack is used for S3/SQS/SES locally

## Quick start (local)

> `docker compose up -d --build` from the repo root spins up Postgres, Localstack, API, client, worker, and scheduler. the sections below break out the pieces if you need finer control

```bash
# 1. API
cd api
npm install
cp .env.example .env        # fill Cognito + AWS + DB vars
psql "postgres://postgres:postgres@localhost:5433/postgres" -f src/workflows/schema.sql
# Slack steps: no env var required; add a Slack webhook integration in the UI.
# AI steps: set OPENAI_API_KEY (or save per-user keys via integrations) and SECRET_ENCRYPTION_KEY for secret storage.

# 2. Client
cd ../client
npm install
cp .env.example .env

# 3. Full stack (from repo root)
docker compose up -d --build db localstack api client worker scheduler

# 4. Seed demo data (optional but recommended)
docker compose build api
docker compose run --rm api npm run seed:dev
# override the dev user id/email if you want to seed your Cognito account:
# DEV_USER_ID=<your-sub> DEV_USER_EMAIL=<you@example.com> docker compose run --rm api npm run seed:dev
```

Open http://localhost:5173, click “Login,” complete the Cognito hosted flow, and you’re in. Use the Workflows page to create/activate/deactivate flows, the detail drawer to edit steps/triggers (when inactive), and the Run History card to inspect/cancel runs. Scheduler logs live at `docker compose logs -f scheduler`; worker logs at `docker compose logs -f worker`.

## Useful commands

| Task                              | Command |
|-----------------------------------|---------|
| Start everything                  | `docker compose up -d --build` |
| API dev server                    | `cd api && npm run dev` |
| Client dev server                 | `cd client && npm run dev` |
| Scheduler (single tick)           | `cd api && npm run scheduler:once` |
| Worker (local loop)               | `cd api && npm run worker` |
| API typecheck / lint / test       | `cd api && npm run typecheck && npm run lint && npm test` |
| Bootstrap Localstack resources    | `cd api && npm run bootstrap:localstack` (optional; only needed if Localstack lost the queue/bucket) |
| Seed demo data                    | `docker compose build api && docker compose run --rm api npm run seed:dev` |
| Client build                      | `cd client && npm run build` |
| Reset schema                      | `psql $DATABASE_URL -f api/src/workflows/schema.sql` |

> Tip: `npm run bootstrap:localstack` recreates the `workflow-runs` SQS queue and `workflow-artifacts-dev` bucket via Localstack. TSX cant open its IPC pipe on some macOS setups—if that happens just skip the bootstrap step and run the integration tests directly (see below)

### Integration testing

1. Start the full stack (`docker compose up -d --build`) so Postgres, Localstack, API, worker etc. are running locally
2. (Optional) Bootstrap Localstack queue/bucket once: `npm run bootstrap:localstack`. Skip this on macOS if TSX can’t open `/var/folders/...`.
3. Execute the end-to-end suite (webhook success/failure, scheduler trigger, cancel run). Either run the npm script:
   ```bash
   cd api
   API_BASE=http://localhost:4000/v1 \
   DATABASE_URL=postgres://postgres:postgres@localhost:5433/workflows \
   TEST_ID_TOKEN='<cognito id token>' \
   npm run test:integration
   ```
   Or skip the bootstrap step and call Node directly (useful on macOS):
   ```bash
   node --import tsx --test \
     src/tests/integration/webhook.test.ts \
     src/tests/integration/scheduler.test.ts \
     src/tests/integration/cancel.test.ts
   ```
   `TEST_ID_TOKEN` lets the test poll `/v1/runs/:id` with cognito auth; if you prefer to bypass auth locally set `SKIP_AUTH=true` in `.env` instead
4. CI runs the same suite via `.github/workflows/ci.yml` (which first runs `npm run bootstrap:localstack` inside Linux containers) so any failure locally will mirror GitHub actions

### Integrations & secrets

- Use the client’s **Settings → Integrations** page to store Slack webhooks or OpenAI API keys. Values are encrypted with `SECRET_ENCRYPTION_KEY` before being written to Postgres
- Slack + AI steps expose dropdowns so you can pick a stored integration instead of pasting secrets into workflow configs. AI steps fall back to the server-wide `OPENAI_API_KEY` if no per-user key is selected
- This pattern can be extended for CRM/email credentials—add a new integration type, reference it in a step, and hydrate the secret before enqueuing runs.

## CI & tests

- `api`: ESLint, `tsc --noEmit`, unit tests (`npm test`), and integration tests (webhook, scheduler, cancel) run in GitHub Actions.
- `client`: `npm run build` ensures the React bundle compiles in CI.

## Product vision & next ideas

- Add more step types (Slack notifications, AI-generated cover letters, spreadsheets) and opinionated trigger templates
- Deploy a live, user-friendly experience (Render/Fly/EC2) so non-technical users can sign in, pick a template and watch it run without Docker
- Bundle “automation kits” (e.g., automatic job applier with AI cover letter generation) and mention that you can add bespoke automations on request
- Instrument metrics dashboards (success rate %, runs per workflow) and surface them alongside Run History
- Publish container images/Lambda bundles from CI plus Terraform modules for the cloud deployment

## License

MIT © 2024 Levi Brimmley
