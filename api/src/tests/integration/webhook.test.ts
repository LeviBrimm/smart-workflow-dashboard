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

test('webhook triggers workflow run', async () => {
  // seed workflow
runSql(`
    INSERT INTO users (id, email, cognito_sub)
    VALUES ('${userIdLiteral}', '${userEmailLiteral}', '${userCognitoSubLiteral}')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO workflows (id, user_id, name, status)
    VALUES ('00000000-0000-0000-0000-000000000001', '${userIdLiteral}', 'Test Flow', 'active')
    ON CONFLICT (id) DO UPDATE
      SET user_id = EXCLUDED.user_id,
          name = EXCLUDED.name,
          status = EXCLUDED.status;

    INSERT INTO triggers (id, workflow_id, kind, config)
    VALUES ('11111111-2222-3333-4444-555555555555', '00000000-0000-0000-0000-000000000001', 'webhook', jsonb_build_object('secret','local-secret'))
    ON CONFLICT (id) DO UPDATE
      SET workflow_id = EXCLUDED.workflow_id,
          config = EXCLUDED.config;

    INSERT INTO steps (id, workflow_id, idx, type, action_kind, config)
    VALUES ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000001', 0, 'action', 'write_s3', jsonb_build_object('key','runs/test-run.json'))
    ON CONFLICT (id) DO UPDATE
      SET workflow_id = EXCLUDED.workflow_id,
          idx = EXCLUDED.idx,
          type = EXCLUDED.type,
          action_kind = EXCLUDED.action_kind,
          config = EXCLUDED.config;
  `);

  const body = JSON.stringify({ payload: 'demo' });
  const signature = crypto.createHmac('sha256', 'local-secret').update(body).digest('hex');

  const response = await fetch(`${BASE_URL}/webhook/11111111-2222-3333-4444-555555555555`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': signature,
    },
    body,
  });

  assert.equal(response.status, 200, 'webhook should respond 200');
  const json = await response.json();
  assert.ok(json.runId, 'run id should be returned');

  // wait for worker to mark run success
  let attempt = 0;
  let status = '';
  while (attempt < 20) {
    const res = await fetch(`${BASE_URL}/runs/${json.runId}`, {
      headers: { Authorization: `Bearer ${process.env.TEST_ID_TOKEN ?? ''}` },
    });
    if (res.status === 200) {
      const detail = await res.json();
      status = detail.run.status;
      if (status === 'success' || status === 'failed') break;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempt += 1;
  }

  assert.equal(status, 'success', 'run should complete successfully');
});
