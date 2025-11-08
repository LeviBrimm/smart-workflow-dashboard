import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import fetch from 'node-fetch';

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

type StepAction = 'write_s3' | 'http_request' | 'send_email';

const seedWebhookWorkflow = ({
  workflowId,
  triggerId,
  secret,
  stepId,
  stepAction,
  stepConfigSql,
  name = 'Test Flow',
}: {
  workflowId: string;
  triggerId: string;
  secret: string;
  stepId: string;
  stepAction: StepAction;
  stepConfigSql: string;
  name?: string;
}) => {
  runSql(`
    INSERT INTO users (id, email, cognito_sub)
    VALUES ('${userIdLiteral}', '${userEmailLiteral}', '${userCognitoSubLiteral}')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO workflows (id, user_id, name, status)
    VALUES ('${workflowId}', '${userIdLiteral}', '${sqlLiteral(name)}', 'active')
    ON CONFLICT (id) DO UPDATE
      SET user_id = EXCLUDED.user_id,
          name = EXCLUDED.name,
          status = EXCLUDED.status;

    INSERT INTO triggers (id, workflow_id, kind, config)
    VALUES ('${triggerId}', '${workflowId}', 'webhook', jsonb_build_object('secret','${sqlLiteral(secret)}'))
    ON CONFLICT (id) DO UPDATE
      SET workflow_id = EXCLUDED.workflow_id,
          config = EXCLUDED.config;

    INSERT INTO steps (id, workflow_id, idx, type, action_kind, config)
    VALUES ('${stepId}', '${workflowId}', 0, 'action', '${stepAction}', ${stepConfigSql})
    ON CONFLICT (id) DO UPDATE
      SET workflow_id = EXCLUDED.workflow_id,
          idx = EXCLUDED.idx,
          type = EXCLUDED.type,
          action_kind = EXCLUDED.action_kind,
          config = EXCLUDED.config;
  `);
};

const getAuthHeaders = () => {
  const raw = process.env.TEST_ID_TOKEN ?? '';
  const token = raw.replace(/[^A-Za-z0-9._-]/g, '');
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
};

type RunDetailResponse = {
  run: { status: string; error?: string };
  steps: Array<{ status: string; error?: string }>;
};

const waitForRunCompletion = async (runId: string) => {
  let attempt = 0;
  let lastDetail: RunDetailResponse | null = null;
  while (attempt < 20) {
    const res = await fetch(`${BASE_URL}/runs/${runId}`, {
      headers: getAuthHeaders(),
    });
    if (res.status === 200) {
      lastDetail = (await res.json()) as RunDetailResponse;
      const status = lastDetail.run.status;
      if (status === 'success' || status === 'failed') {
        return lastDetail;
      }
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempt += 1;
  }
  throw new Error(`Run did not complete. Last status: ${lastDetail?.run.status ?? 'unknown'}`);
};

const invokeWebhook = async (triggerId: string, secret: string, body: Record<string, unknown> = { payload: 'demo' }) => {
  const jsonBody = JSON.stringify(body);
  const signature = crypto.createHmac('sha256', secret).update(jsonBody).digest('hex');

  const response = await fetch(`${BASE_URL}/webhook/${triggerId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': signature,
    },
    body: jsonBody,
  });

  assert.equal(response.status, 200, 'webhook should respond 200');
  return (await response.json()) as { runId: string };
};

test('webhook triggers workflow run', async () => {
  seedWebhookWorkflow({
    workflowId: '00000000-0000-0000-0000-000000000001',
    triggerId: '11111111-2222-3333-4444-555555555555',
    secret: 'local-secret',
    stepId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    stepAction: 'write_s3',
    stepConfigSql: "jsonb_build_object('key','runs/test-run.json')",
  });

  const { runId } = await invokeWebhook('11111111-2222-3333-4444-555555555555', 'local-secret');
  const detail = await waitForRunCompletion(runId);

  assert.equal(detail.run.status, 'success', 'run should complete successfully');
  assert.equal(detail.steps[0]?.status, 'success', 'step should succeed');
});

test('webhook run surfaces failure when step executor throws', async () => {
  seedWebhookWorkflow({
    workflowId: '00000000-0000-0000-0000-000000000002',
    triggerId: 'aaaaaaaa-bbbb-cccc-dddd-ffffffffffff',
    secret: 'failure-secret',
    stepId: 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff',
    stepAction: 'http_request',
    stepConfigSql: "jsonb_build_object('url','http://127.0.0.1:9/fail')",
    name: 'Failure Flow',
  });

  const { runId } = await invokeWebhook('aaaaaaaa-bbbb-cccc-dddd-ffffffffffff', 'failure-secret');
  const detail = await waitForRunCompletion(runId);

  assert.equal(detail.run.status, 'failed', 'run should be marked failed');
  assert.ok(detail.run.error, 'run error should be populated');
  assert.equal(detail.steps[0]?.status, 'failed', 'step should be marked failed');
  assert.ok(detail.steps[0]?.error, 'step error should be populated');
});
