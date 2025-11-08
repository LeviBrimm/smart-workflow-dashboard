import { pool } from '../lib/db.js';

interface StepRow {
  idx: number;
  action_kind: string;
  config: Record<string, unknown>;
}

export interface RunEnvelope {
  runId: string;
  workflowId: string;
  userId: string;
  triggerId: string;
  steps: Array<{ idx: number; action: string; config: Record<string, unknown> }>;
  input: { payload: Record<string, unknown> };
}

export const createRunForTrigger = async (triggerId: string, payload: Record<string, unknown>): Promise<RunEnvelope> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const triggerRes = await client.query<{
      workflow_id: string;
      user_id: string;
    }>(
      'SELECT t.workflow_id, w.user_id FROM triggers t JOIN workflows w ON t.workflow_id = w.id WHERE t.id = $1',
      [triggerId]
    );

    if (!triggerRes.rowCount) {
      throw new Error('Trigger not found');
    }

    const { workflow_id: workflowId, user_id: userId } = triggerRes.rows[0];

    const stepsRes = await client.query<StepRow>(
      'SELECT idx, action_kind, config FROM steps WHERE workflow_id = $1 ORDER BY idx ASC',
      [workflowId]
    );

    if (!stepsRes.rowCount) {
      throw new Error('Workflow has no steps configured');
    }

    const runRes = await client.query<{ id: string }>(
      "INSERT INTO runs (workflow_id, trigger_id, status, input_payload) VALUES ($1, $2, 'queued', $3) RETURNING id",
      [workflowId, triggerId, payload]
    );

    await client.query('COMMIT');

    return {
      runId: runRes.rows[0].id,
      workflowId,
      userId,
      triggerId,
      steps: stepsRes.rows.map(step => ({ idx: step.idx, action: step.action_kind, config: step.config })),
      input: { payload },
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
