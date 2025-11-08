# Smart Workflow Dashboard

[![CI](https://github.com/levibrimm/smart-workflow-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/levibrimm/smart-workflow-dashboard/actions/workflows/ci.yml)

Opinionated starter kit for building internal automations: React dashboard, Express API, Postgres, and AWS primitives (Cognito, SQS, S3, SES, Lambda workers) wired together for local development.

## What’s inside

- **api/** – TypeScript Express service with workflow CRUD, trigger management, webhook entry point, scheduler job, and SQS worker.
- **client/** – Vite + React + React Query front‑end: workflow builder, run history, Cognito login, tokens persisted in localStorage.
- **lambdas/** – Scheduler and worker handlers (share code with the API).
- **docker-compose.yml** – Boots Postgres, API, client (nginx), Localstack, SQS worker, and scheduler with one command.
- **.github/workflows/ci.yml** – Lints/typechecks/tests the API and builds the client on every push/PR.

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
- AWS CLI credentials **not** required; Localstack is used for S3/SQS/SES locally.

## Quick start

```bash
# 1. API
cd api
npm install
cp .env.example .env        # fill Cognito + AWS + DB vars
psql "postgres://postgres:postgres@localhost:5433/postgres" -f src/workflows/schema.sql

# 2. Client
cd ../client
npm install
cp .env.example .env

# 3. Full stack (from repo root)
docker compose up -d --build db localstack api client worker scheduler
```

Open http://localhost:5173, click “Login,” complete the Cognito hosted flow, and you’re ready to create workflows. Scheduler logs live at `docker compose logs -f scheduler`; worker logs at `docker compose logs -f worker`.

## Key features

- Cognito-hosted login with tokens persisted locally and automatically refreshed.
- Workflow builder with steps (HTTP request, send email via SES, write JSON to S3) and triggers (cron schedule, signed webhook).
- Scheduler service polls cron triggers and enqueues runs on SQS.
- Worker service dequeues runs, executes steps sequentially, logs run/step state in Postgres, and writes artifacts to S3.
- Webhook endpoint requires HMAC signatures; API routes require Cognito JWTs.
- UI run history shows trigger type, duration, and per-step logs; clicking a run expands the step outputs/errors inline.

## Useful commands

| Task                              | Command |
|-----------------------------------|---------|
| Start everything                  | `docker compose up -d --build` |
| API dev server                    | `cd api && npm run dev` |
| Client dev server                 | `cd client && npm run dev` |
| Scheduler (single tick)           | `cd api && npm run scheduler:once` |
| Worker (local loop)               | `cd api && npm run worker` |
| API typecheck / lint / test       | `cd api && npm run typecheck && npm run lint && npm test` |
| Bootstrap Localstack resources    | `cd api && npm run bootstrap:localstack` |
| Client build                      | `cd client && npm run build` |
| Reset schema                      | `psql $DATABASE_URL -f api/src/workflows/schema.sql` |

> Tip: `npm run bootstrap:localstack` rewrites the `localstack` hostname to `localhost` so it can talk to the compose stack from your host OS. If you ever run it inside a container, set `LOCALSTACK_HOST_OVERRIDE=localstack` so it keeps the internal service name.

### Integration testing

1. Start the full stack (`docker compose up -d --build`) so Postgres, Localstack, API, worker, etc. are running locally.
2. From `api/`, bootstrap the Localstack queue and bucket: `npm run bootstrap:localstack`. This is idempotent, so run it whenever Localstack restarts.
3. Execute the end-to-end webhook test:
   ```bash
   cd api
   API_BASE=http://localhost:4000/v1 \
   DATABASE_URL=postgres://postgres:postgres@localhost:5433/workflows \
   TEST_ID_TOKEN='<cognito id token>' \
   npm run test:integration
   ```
   The `TEST_ID_TOKEN` lets the test poll `/v1/runs/:id` with Cognito auth; if you prefer to bypass auth locally, set `SKIP_AUTH=true` in `.env` instead.
4. CI runs the same script in `.github/workflows/ci.yml` (with `SKIP_AUTH=true`), so any failure locally will match what GitHub Actions reports.

## CI & tests

- `api`: ESLint, `tsc --noEmit`, and Node’s built-in test runner (`npm test`) run in GitHub Actions. Tests cover cron helpers and the templating engine that powers step configs.
- `client`: `npm run build` ensures the React bundle compiles in CI.

## Roadmap / nice-to-haves

1. Expand test coverage (integration tests for webhook → SQS → worker flow).
2. Publish docker images + Lambda bundles from CI.
3. Add more actions (Slack, spreadsheets, generic HTTP transformer) and richer scheduler UI.
4. Terraform/Crossplane definitions for Cognito, RDS/Neon, SQS, Lambda, CloudWatch alarms.

## License

MIT © 2024 Levi Brimmley
