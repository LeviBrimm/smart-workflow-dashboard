import { z } from 'zod';
import { pool } from '../lib/db.js';
import { encryptSecret, decryptSecret } from '../lib/secrets.js';

const ensureUser = (userId?: string) => {
  if (!userId) {
    throw new Error('User context required');
  }
  return userId;
};

const IntegrationTypes = ['slack_webhook', 'openai'] as const;
export type IntegrationType = (typeof IntegrationTypes)[number];

const integrationInputSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(IntegrationTypes),
  secret: z.string().min(1),
  config: z.record(z.any()).optional(),
});

const integrationUpdateSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    config: z.record(z.any()).optional(),
    secret: z.string().min(1).optional(),
  })
  .refine(data => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export interface IntegrationRecord {
  id: string;
  name: string;
  type: IntegrationType;
  config: Record<string, unknown>;
  createdAt: string;
}

const mapRow = (row: {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  created_at: string;
}): IntegrationRecord => ({
  id: row.id,
  name: row.name,
  type: row.type as IntegrationType,
  config: row.config ?? {},
  createdAt: row.created_at,
});

export const listIntegrations = async (userId?: string): Promise<IntegrationRecord[]> => {
  const ownerId = ensureUser(userId);
  const { rows } = await pool.query(
    'SELECT id, name, type, config, created_at FROM user_integrations WHERE user_id = $1 ORDER BY created_at DESC',
    [ownerId]
  );
  return rows.map(mapRow);
};

export const createIntegration = async (payload: unknown, userId?: string): Promise<IntegrationRecord> => {
  const ownerId = ensureUser(userId);
  const data = integrationInputSchema.parse(payload);
  const encrypted = encryptSecret(data.secret);
  const { rows } = await pool.query(
    `INSERT INTO user_integrations (user_id, name, type, config, secret_encrypted)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, type, config, created_at`,
    [ownerId, data.name, data.type, data.config ?? {}, encrypted]
  );
  return mapRow(rows[0]);
};

export const deleteIntegration = async (integrationId: string, userId?: string): Promise<void> => {
  const ownerId = ensureUser(userId);
  await pool.query('DELETE FROM user_integrations WHERE id = $1 AND user_id = $2', [integrationId, ownerId]);
};

export const updateIntegration = async (
  integrationId: string,
  payload: unknown,
  userId?: string
): Promise<IntegrationRecord> => {
  const ownerId = ensureUser(userId);
  const data = integrationUpdateSchema.parse(payload);

  const sets: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined) {
    sets.push(`name = $${sets.length + 3}`);
    values.push(data.name);
  }

  if (data.config !== undefined) {
    sets.push(`config = $${sets.length + 3}`);
    values.push(data.config);
  }

  if (data.secret !== undefined) {
    sets.push(`secret_encrypted = $${sets.length + 3}`);
    values.push(encryptSecret(data.secret));
  }

  if (!sets.length) {
    throw new Error('No fields to update');
  }

  const query = `
    UPDATE user_integrations
    SET ${sets.join(', ')}
    WHERE id = $1 AND user_id = $2
    RETURNING id, name, type, config, created_at
  `;

  const { rows } = await pool.query(query, [integrationId, ownerId, ...values]);
  if (!rows.length) {
    throw new Error('Integration not found');
  }
  return mapRow(rows[0]);
};

export const fetchIntegrationSecrets = async (
  userId: string,
  ids: string[]
): Promise<Map<string, { type: IntegrationType; secret: string; config: Record<string, unknown> }>> => {
  if (!ids.length) {
    return new Map();
  }
  const { rows } = await pool.query(
    'SELECT id, type, config, secret_encrypted FROM user_integrations WHERE user_id = $1 AND id = ANY($2::uuid[])',
    [userId, ids]
  );
  const map = new Map<string, { type: IntegrationType; secret: string; config: Record<string, unknown> }>();
  for (const row of rows) {
    map.set(row.id, {
      type: row.type as IntegrationType,
      config: row.config ?? {},
      secret: decryptSecret(row.secret_encrypted),
    });
  }
  return map;
};
