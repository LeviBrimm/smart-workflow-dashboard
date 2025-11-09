import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fetch from 'node-fetch';
import { runScheduler } from '../../jobs/scheduler.js';

if (!process.env.LOCALSTACK_HOST_OVERRIDE) {
  process.env.LOCALSTACK_HOST_OVERRIDE = 'localhost';
}
if (!process.env.SQS_ENDPOINT) {
  process.env.SQS_ENDPOINT = 'http://localhost:4566';
}
if (!process.env.S3_ENDPOINT) {
  process.env.S3_ENDPOINT = 'http://localhost:4566';
}

const BASE_URL = process.env.API_BASE ?? 'http://localhost:4000/v1';
const DB_URL = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5433/workflows';

const runSql = (sql: string) => {
  execSync(`psql "${DB_URL}" -c "${sql.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
};

const decodeJwtPayload = (token: string) => {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const getTestUser = () => {
  const payload = process.env.TEST_ID_TOKEN ? decodeJwtPayload(process.env.TEST_ID_TOKEN) : null;
  const fallbackId = '11111111-1111-1111-1111-111111111111';

  const id = process.env.TEST_USER_ID ?? (typeof payload?.sub === 'string' ? payload.sub : fallbackId);
  const email =
    process.env.TEST_USER_EMAIL ??
    (typeof payload?.email === 'string' ? payload.email : 'test@example.com');
  const cognitoSub =
    process.env.TEST_USER_COGNITO_SUB ??
    (typeof payload?.sub === 'string' ? payload.sub : fallbackId);

  return { id, email, cognitoSub };
};

const sqlLiteral = (value: string) => value.replace(/'/g, "''");
const testUser = getTestUser();
const userIdLiteral = sqlLiteral(testUser.id);
const userEmailLiteral = sqlLiteral(testUser.email);
const userCognitoSubLiteral = sqlLiteral(testUser.cognitoSub);

const getLatestRunId = (workflowId: string) => {
  const output = execSync(
    `psql "${DB_URL}" -t -A -c "SELECT id FROM runs WHERE workflow_id = '${workflowId}' ORDER BY COALESCE(started_at, NOW()) DESC, id DESC LIMIT 1"`
  )
    .toString()
    .trim();
  return output || null;
};

const getAuthHeaders = (): Record<string, string> => {
  const raw = process.env.TEST_ID_TOKEN ?? '';
  const token = raw.replace(/[^A-Za-z0-9._-]/g, '');
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
};

type RunDetailResponse = {
  run: { status: string };
  steps: Array<{ status: string }>;
};

const waitForRunCompletion = async (runId: string) => {
  let attempt = 0;
  while (attempt < 20) {
    const res = await fetch(`${BASE_URL}/runs/${runId}`, {
      headers: getAuthHeaders(),
    });
    if (res.status === 200) {
      const detail = (await res.json()) as RunDetailResponse;
      if (detail.run.status === 'success' || detail.run.status === 'failed') {
        return detail;
      }
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempt += 1;
  }
  throw new Error('Run did not complete in time');
};

const WORKFLOW_ID = '00000000-0000-0000-0000-0000000000aa';
const TRIGGER_ID = 'aaaaaaaa-1111-2222-3333-444444444444';
const STEP_ID = 'bbbbbbbb-1111-2222-3333-444444444444';

test('scheduler enqueues due schedule triggers', async () => {
  runSql(`
    DELETE FROM run_steps WHERE run_id IN (SELECT id FROM runs WHERE workflow_id = '${WORKFLOW_ID}');
    DELETE FROM runs WHERE workflow_id = '${WORKFLOW_ID}';
    DELETE FROM steps WHERE workflow_id = '${WORKFLOW_ID}';
    DELETE FROM triggers WHERE id = '${TRIGGER_ID}' OR workflow_id = '${WORKFLOW_ID}';
    DELETE FROM workflows WHERE id = '${WORKFLOW_ID}';

    INSERT INTO users (id, email, cognito_sub)
    VALUES ('${userIdLiteral}', '${userEmailLiteral}', '${userCognitoSubLiteral}')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO workflows (id, user_id, name, status)
    VALUES ('${WORKFLOW_ID}', '${userIdLiteral}', 'Scheduler Flow', 'active')
    ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, name = EXCLUDED.name, status = EXCLUDED.status;

    INSERT INTO steps (id, workflow_id, idx, type, action_kind, config)
    VALUES ('${STEP_ID}', '${WORKFLOW_ID}', 0, 'action', 'write_s3', jsonb_build_object('key','runs/scheduler-test.json'))
    ON CONFLICT (id) DO UPDATE
      SET workflow_id = EXCLUDED.workflow_id,
          idx = EXCLUDED.idx,
          type = EXCLUDED.type,
          action_kind = EXCLUDED.action_kind,
          config = EXCLUDED.config;

    INSERT INTO triggers (id, workflow_id, kind, config)
    VALUES ('${TRIGGER_ID}', '${WORKFLOW_ID}', 'schedule', jsonb_build_object('cron','* * * * *'))
    ON CONFLICT (id) DO UPDATE
      SET workflow_id = EXCLUDED.workflow_id,
          config = EXCLUDED.config;
  `);

  const queued = await runScheduler(new Date());
  assert.equal(queued, 1, 'scheduler should enqueue one run');

  const runId = getLatestRunId(WORKFLOW_ID);
  assert.ok(runId, 'run should exist after scheduler executes');

  const detail = await waitForRunCompletion(runId as string);
  assert.equal(detail.run.status, 'success', 'scheduled run should succeed');
  assert.equal(detail.steps[0]?.status, 'success', 'step should succeed');
});
