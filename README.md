# Smart Workflow Dashboard

[![CI](https://github.com/levibrimm/smart-workflow-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/levibrimm/smart-workflow-dashboard/actions/workflows/ci.yml)

Smart Workflow Dashboard is a fully dockerized automation studio. React + Tailwind on the front-end, an Express/Node API, Postgres, and Localstack-powered AWS primitives (Cognito, SQS, S3, SES) are stitched together by worker and scheduler processes. You can build workflows, fan out webhook or cron triggers, monitor every run, and cancel or edit flows in a friendly UI—no external cloud account required.

> 🎥 **Demo** – drop your screenshots/GIFs/video link here once recorded (e.g. `docs/media/demo.mp4`). Show: login, create/edit workflow, run history + cancel button, toast notifications, scheduler log tail, and the integration tests finishing green.

## Highlights (what a reviewer should notice)

- **Workflow builder with guardrails** – create/edit multi-step workflows (HTTP request, send email, write to S3) and assign webhook or cron triggers. Deactivate/activate flows without losing configuration.
- **Run history + control center** – inspect every run with a timeline, sticky detail drawer, per-step outputs/errors, and the new “Cancel run” action (complete with toast feedback).
- **Always-on infrastructure** – worker and scheduler containers drain queues and cron schedules; Localstack emulates AWS resources locally, so the stack mirrors production without external credentials.
- **Modern step library** – mix HTTP/email/S3 actions with Slack notifications and AI-generated content steps; template expressions let you pass data between steps.
- **Polished, human-friendly UI** – cohesive light palette, readable typography, trigger/status badges, keyboard navigation, toasts, and edit-only-when-safe affordances.
- **Integration confidence** – webhook success/failure, scheduler flow, and cancel-run paths are covered end-to-end via Node’s test runner hitting the real dockerized stack (no mocks).
- **Portfolio-ready story** – same codebase can power bespoke automations (job applier, outreach cadences, monitoring alerts). Clients describe outcomes; you wire the workflow template.

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

## Quick start (local)

> Prefer to _see_ it first? `docker compose up -d --build` from the repo root spins up Postgres, Localstack, API, client, worker, and scheduler in one shot. The sections below break out the pieces if you need finer control.

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

> Tip: `npm run bootstrap:localstack` recreates the `workflow-runs` SQS queue and `workflow-artifacts-dev` bucket via Localstack. TSX can’t open its IPC pipe on some macOS setups—if that happens, skip the bootstrap step and run the integration tests directly (see below).

### Integration testing

1. Start the full stack (`docker compose up -d --build`) so Postgres, Localstack, API, worker, etc. are running locally.
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
   `TEST_ID_TOKEN` lets the test poll `/v1/runs/:id` with Cognito auth; if you prefer to bypass auth locally, set `SKIP_AUTH=true` in `.env` instead.
4. CI runs the same suite via `.github/workflows/ci.yml` (which first runs `npm run bootstrap:localstack` inside Linux containers), so any failure locally will mirror GitHub Actions.

### Integrations & secrets

- Use the client’s **Settings → Integrations** page to store Slack webhooks or OpenAI API keys. Values are encrypted with `SECRET_ENCRYPTION_KEY` before being written to Postgres.
- Slack + AI steps expose dropdowns so you can pick a stored integration instead of pasting secrets into workflow configs. AI steps fall back to the server-wide `OPENAI_API_KEY` if no per-user key is selected.
- This pattern can be extended for CRM/email credentials—add a new integration type, reference it in a step, and hydrate the secret before enqueuing runs.

## Demo / portfolio checklist

Use this as your run-of-show when recording or presenting:

1. **30-second pitch** – “A self-hosted Zapier-style workflow engine. I can add templates (job applier, outreach, monitoring) for clients without exposing Docker or AWS details.”
2. **Login + theming** – show the Cognito-hosted login, the light palette, and the workflow list.
3. **Workflow editing** – deactivate a workflow, edit steps/triggers (note that edits are only allowed while paused), reactivate once satisfied.
4. **Run history** – trigger a run, open the detail drawer, and use the “Cancel run” action to demonstrate ops control + toast feedback.
5. **Scheduler/worker logs** – tail `docker compose logs -f scheduler worker` for a few seconds to prove background processes exist.
6. **Integration tests** – run the command with a real Cognito token so viewers see the entire suite finishing green.
7. **Vision slide** – wrap up with “How I’d turn this into a hosted automation template product” (offer custom flows by email, ship new templates often).

Add screenshots or architecture diagrams in `docs/` and reference them here (GitHub renders images in README automatically).

## CI & tests

- `api`: ESLint, `tsc --noEmit`, unit tests (`npm test`), and integration tests (webhook, scheduler, cancel) run in GitHub Actions.
- `client`: `npm run build` ensures the React bundle compiles in CI.

## Product vision & next ideas

- Add more step types (Slack notifications, AI-generated cover letters, spreadsheets) and opinionated trigger templates.
- Deploy a live, user-friendly experience (Render/Fly/EC2) so non-technical users can sign in, pick a template, and watch it run without Docker.
- Bundle “automation kits” (e.g., automatic job applier with AI cover letter generation) and mention that you can add bespoke automations on request.
- Instrument metrics dashboards (success rate %, runs per workflow) and surface them alongside Run History.
- Publish container images/Lambda bundles from CI plus Terraform modules for the cloud deployment.

## License

MIT © 2024 Levi Brimmley
