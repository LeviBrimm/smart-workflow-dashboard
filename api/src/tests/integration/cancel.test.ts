import test from 'node:test';
import assert from 'node:assert/strict';
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

const getAuthHeaders = (): Record<string, string> => {
  const raw = process.env.TEST_ID_TOKEN ?? '';
  const token = raw.replace(/[^A-Za-z0-9._-]/g, '');
  if (!token) return {};
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
};

const WORKFLOW_ID = '00000000-0000-0000-0000-0000000000bb';
const RUN_ID = 'cccccccc-1111-2222-3333-444444444444';

test('cancel run endpoint marks queued run as canceled', async () => {
  runSql(`
    DELETE FROM run_steps WHERE run_id = '${RUN_ID}';
    DELETE FROM runs WHERE id = '${RUN_ID}';
    DELETE FROM workflows WHERE id = '${WORKFLOW_ID}';

    INSERT INTO users (id, email, cognito_sub)
    VALUES ('${userIdLiteral}', '${userEmailLiteral}', '${userCognitoSubLiteral}')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO workflows (id, user_id, name, status)
    VALUES ('${WORKFLOW_ID}', '${userIdLiteral}', 'Cancel Flow', 'active')
    ON CONFLICT (id) DO UPDATE
      SET user_id = EXCLUDED.user_id,
          name = EXCLUDED.name,
          status = EXCLUDED.status;

    INSERT INTO runs (id, workflow_id, status, input_payload)
    VALUES ('${RUN_ID}', '${WORKFLOW_ID}', 'queued', jsonb_build_object('payload','demo'))
    ON CONFLICT (id) DO UPDATE SET workflow_id = EXCLUDED.workflow_id, status = EXCLUDED.status;
  `);

  const response = await fetch(`${BASE_URL}/runs/${RUN_ID}/cancel`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  assert.equal(response.status, 200, 'cancel endpoint should return 200');
  const json = (await response.json()) as { ok: boolean };
  assert.ok(json.ok, 'response should include ok true');

  const status = execSync(`psql "${DB_URL}" -t -A -c "SELECT status FROM runs WHERE id = '${RUN_ID}'"`).toString().trim();
  assert.equal(status, 'canceled', 'run should be marked canceled');
});
