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

test('integrations API supports create, update, list, delete', async () => {
  const integrationName = `Integration ${Date.now()}`;

  runSql(`
    DELETE FROM user_integrations WHERE user_id = '${userIdLiteral}' AND name LIKE 'Integration %';
    INSERT INTO users (id, email, cognito_sub)
    VALUES ('${userIdLiteral}', '${userEmailLiteral}', '${userCognitoSubLiteral}')
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, cognito_sub = EXCLUDED.cognito_sub;
  `);

  const createResponse = await fetch(`${BASE_URL}/integrations`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      name: integrationName,
      type: 'slack_webhook',
      secret: 'https://hooks.slack.com/services/test/test/test',
      config: { channel: '#integration-tests' },
    }),
  });

  assert.equal(createResponse.status, 201, 'create integration should return 201');
  const created = (await createResponse.json()) as { id: string; name: string; type: string };
  assert.ok(created.id, 'created integration should return id');
  assert.equal(created.name, integrationName);
  assert.equal(created.type, 'slack_webhook');

  const patchResponse = await fetch(`${BASE_URL}/integrations/${created.id}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      name: `${integrationName} Updated`,
      config: { channel: '#updated' },
    }),
  });
  assert.equal(patchResponse.status, 200, 'update should return 200');
  const updated = (await patchResponse.json()) as { name: string; config: { channel: string } };
  assert.equal(updated.name, `${integrationName} Updated`);
  assert.equal(updated.config.channel, '#updated');

  const listResponse = await fetch(`${BASE_URL}/integrations`, { headers: getAuthHeaders() });
  assert.equal(listResponse.status, 200);
  const list = (await listResponse.json()) as Array<{ id: string; name: string }>;
  const found = list.find(row => row.id === created.id);
  assert.ok(found, 'created integration should appear in list');

  const deleteResponse = await fetch(`${BASE_URL}/integrations/${created.id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  assert.equal(deleteResponse.status, 204, 'delete should return 204');

  const remaining = execSync(
    `psql "${DB_URL}" -t -A -c "SELECT count(*) FROM user_integrations WHERE user_id = '${userIdLiteral}' AND id = '${created.id}'"`
  )
    .toString()
    .trim();
  assert.equal(remaining, '0', 'integration should be removed from database');
});
