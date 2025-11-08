import type { PoolClient, QueryResultRow } from 'pg';
import { z } from 'zod';
import { pool, withTransaction } from '../lib/db.js';
import type { WorkflowDetail, WorkflowStatus, WorkflowSummary } from '../types/workflow.js';

const workflowInputSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  steps: z
    .array(
      z.object({
        id: z.string().optional(),
        idx: z.number().int().nonnegative(),
        actionKind: z.enum(['send_email', 'http_request', 'write_s3']),
        config: z.record(z.any()),
      })
    )
    .optional(),
  triggers: z
    .array(
      z.object({
        id: z.string().optional(),
        kind: z.enum(['schedule', 'webhook']),
        config: z.record(z.any()),
      })
    )
    .optional(),
});

const ensureUser = (userId?: string) => {
  if (!userId) {
    throw new Error('User context required');
  }
  return userId;
};

const run = async <T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[], client?: PoolClient) => {
  if (client) {
    return client.query<T>(sql, params);
  }
  return pool.query<T>(sql, params);
};

type WorkflowRow = {
  id: string;
  name: string;
  status: WorkflowStatus;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type StepRow = {
  id: string;
  idx: number;
  action_kind: string;
  config: Record<string, unknown>;
};

type TriggerRow = {
  id: string;
  workflow_id: string;
  kind: string;
  config: Record<string, unknown>;
};

const hydrateWorkflow = async (id: string, client?: PoolClient): Promise<WorkflowDetail | null> => {
  const workflowRes = await run<WorkflowRow>(
    'SELECT id, name, status, description, created_at, updated_at FROM workflows WHERE id = $1',
    [id],
    client
  );

  if (!workflowRes.rows.length) {
    return null;
  }

  const [stepsRes, triggersRes] = await Promise.all([
    run<StepRow>('SELECT id, idx, action_kind, config FROM steps WHERE workflow_id = $1 ORDER BY idx ASC', [id], client),
    run<TriggerRow>(
      'SELECT id, workflow_id, kind, config FROM triggers WHERE workflow_id = $1 ORDER BY created_at ASC',
      [id],
      client
    ),
  ]);

  const row = workflowRes.rows[0];
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    description: row.description ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    steps: stepsRes.rows.map(
      (step): WorkflowDetail['steps'][number] => ({
        id: step.id,
        idx: step.idx,
        actionKind: step.action_kind as WorkflowDetail['steps'][number]['actionKind'],
        config: step.config,
      })
    ),
    triggers: triggersRes.rows.map(
      (trigger): WorkflowDetail['triggers'][number] => ({
        id: trigger.id,
        workflowId: trigger.workflow_id,
        kind: trigger.kind as WorkflowDetail['triggers'][number]['kind'],
        config: trigger.config,
      })
    ),
  };
};

export const listWorkflows = async (userId?: string): Promise<WorkflowSummary[]> => {
  const ownerId = ensureUser(userId);
  const rows = await pool.query<WorkflowSummary & { created_at: string; updated_at: string }>(
    'SELECT id, name, status, description, created_at, updated_at FROM workflows WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',
    [ownerId]
  );

  return rows.rows.map(row => ({
    id: row.id,
    name: row.name,
    status: row.status as WorkflowStatus,
    description: row.description ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};

export const getWorkflowDetail = async (id: string, userId?: string): Promise<WorkflowDetail | null> => {
  const ownerId = ensureUser(userId);
  const exists = await pool.query('SELECT id FROM workflows WHERE id = $1 AND user_id = $2 LIMIT 1', [id, ownerId]);
  if (!exists.rowCount) {
    return null;
  }
  return hydrateWorkflow(id);
};

export const createWorkflow = async (payload: unknown, userId?: string): Promise<WorkflowDetail> => {
  const ownerId = ensureUser(userId);
  const data = workflowInputSchema.parse(payload);

  return withTransaction(async client => {
    const workflowRes = await client.query<{ id: string }>(
      'INSERT INTO workflows (id, user_id, name, status, description) VALUES (gen_random_uuid(), $1, $2, $3, $4) RETURNING id',
      [ownerId, data.name ?? 'Untitled Workflow', data.status ?? 'inactive', data.description ?? null]
    );

    const workflowId = workflowRes.rows[0].id;

    if (data.steps?.length) {
      await Promise.all(
        data.steps.map(step =>
          client.query(
            'INSERT INTO steps (id, workflow_id, idx, type, action_kind, config) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)',
            [workflowId, step.idx, 'action', step.actionKind, step.config]
          )
        )
      );
    }

    if (data.triggers?.length) {
      await Promise.all(
        data.triggers.map(trigger =>
          client.query('INSERT INTO triggers (id, workflow_id, kind, config) VALUES (gen_random_uuid(), $1, $2, $3)', [
            workflowId,
            trigger.kind,
            trigger.config,
          ])
        )
      );
    }

    const workflow = await hydrateWorkflow(workflowId, client);
    if (!workflow) {
      throw new Error('Workflow hydration failed');
    }
    return workflow;
  });
};

export const updateWorkflow = async (id: string, payload: unknown, userId?: string): Promise<WorkflowDetail> => {
  const ownerId = ensureUser(userId);
  const data = workflowInputSchema.parse(payload);

  return withTransaction(async client => {
    const existing = await client.query('SELECT id FROM workflows WHERE id = $1 AND user_id = $2', [id, ownerId]);
    if (!existing.rowCount) {
      throw new Error('Workflow not found');
    }

    if (data.name || data.description || data.status) {
      await client.query(
        'UPDATE workflows SET name = COALESCE($1, name), description = COALESCE($2, description), status = COALESCE($3, status), updated_at = NOW() WHERE id = $4',
        [data.name ?? null, data.description ?? null, data.status ?? null, id]
      );
    }

    if (data.steps) {
      await client.query('DELETE FROM steps WHERE workflow_id = $1', [id]);
      if (data.steps.length) {
        await Promise.all(
          data.steps.map(step =>
            client.query(
              'INSERT INTO steps (id, workflow_id, idx, type, action_kind, config) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)',
              [id, step.idx, 'action', step.actionKind, step.config]
            )
          )
        );
      }
    }

    if (data.triggers) {
      await client.query('DELETE FROM triggers WHERE workflow_id = $1', [id]);
      if (data.triggers.length) {
        await Promise.all(
          data.triggers.map(trigger =>
            client.query('INSERT INTO triggers (id, workflow_id, kind, config) VALUES (gen_random_uuid(), $1, $2, $3)', [
              id,
              trigger.kind,
              trigger.config,
            ])
          )
        );
      }
    }

    const workflow = await hydrateWorkflow(id, client);
    if (!workflow) {
      throw new Error('Workflow hydration failed');
    }
    return workflow;
  });
};

export const setWorkflowStatus = async (id: string, status: WorkflowStatus, userId?: string): Promise<WorkflowDetail> => {
  const ownerId = ensureUser(userId);
  const result = await pool.query('UPDATE workflows SET status = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3', [
    status,
    id,
    ownerId,
  ]);
  if (!result.rowCount) {
    throw new Error('Workflow not found');
  }
  const workflow = await getWorkflowDetail(id, ownerId);
  if (!workflow) {
    throw new Error('Workflow not found after update');
  }
  return workflow;
};

export const deleteWorkflow = async (id: string, userId?: string) => {
  const ownerId = ensureUser(userId);
  await pool.query('DELETE FROM workflows WHERE id = $1 AND user_id = $2', [id, ownerId]);
};
