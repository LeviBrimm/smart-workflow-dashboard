import { pool } from '../lib/db.js';
import type { RunRecord, RunStepRecord } from '../types/workflow.js';

const ensureUser = (userId?: string) => {
  if (!userId) throw new Error('User context required');
  return userId;
};

export const listWorkflowRuns = async (
  workflowId: string,
  userId?: string,
  status?: string,
  limit = 20,
  cursor?: string
) => {
  const ownerId = ensureUser(userId);
  const params: unknown[] = [workflowId, ownerId];
  let sql =
    `SELECT r.id, r.workflow_id, r.trigger_id, r.status, r.started_at, r.ended_at, r.result_payload,
            t.kind as trigger_kind
     FROM runs r
     JOIN workflows w ON r.workflow_id = w.id
     LEFT JOIN triggers t ON t.id = r.trigger_id
     WHERE r.workflow_id = $1 AND w.user_id = $2`;

  if (status) {
    params.push(status);
    sql += ` AND r.status = $${params.length}`;
  }

  if (cursor) {
    params.push(cursor);
    sql += ` AND r.started_at < $${params.length}`;
  }

  params.push(limit);
  sql += ` ORDER BY r.started_at DESC NULLS LAST LIMIT $${params.length}`;

  type RunRow = {
    id: string;
    workflow_id: string;
    trigger_id: string | null;
    trigger_kind: string | null;
    status: string;
    started_at: string | null;
    ended_at: string | null;
    result_payload: Record<string, unknown> | null;
  };
  const result = await pool.query<RunRow>(sql, params);
  return result.rows.map(
    (row): RunRecord => ({
      id: row.id,
      workflowId: row.workflow_id,
      triggerId: row.trigger_id,
      triggerKind: row.trigger_kind ? (row.trigger_kind as RunRecord['triggerKind']) : undefined,
      status: row.status as RunRecord['status'],
      startedAt: row.started_at ?? undefined,
      endedAt: row.ended_at ?? undefined,
      durationMs:
        row.started_at && row.ended_at ? Date.parse(row.ended_at) - Date.parse(row.started_at) : undefined,
      resultPayload: row.result_payload ?? undefined,
    })
  );
};

export const getRunDetail = async (id: string, userId?: string) => {
  const ownerId = ensureUser(userId);
  type RunDetailRow = {
    id: string;
    workflow_id: string;
    trigger_id: string | null;
    trigger_kind: string | null;
    status: string;
    started_at: string | null;
    ended_at: string | null;
    input_payload: Record<string, unknown> | null;
    result_payload: Record<string, unknown> | null;
    error: string | null;
  };
  const runRes = await pool.query<RunDetailRow>(
    `SELECT r.*, t.kind as trigger_kind
     FROM runs r
     JOIN workflows w ON r.workflow_id = w.id
     LEFT JOIN triggers t ON t.id = r.trigger_id
     WHERE r.id = $1 AND w.user_id = $2`,
    [id, ownerId]
  );

  if (!runRes.rowCount) {
    return null;
  }

  type RunStepRow = {
    id: string;
    run_id: string;
    step_idx: number;
    status: string;
    started_at: string | null;
    ended_at: string | null;
    input: Record<string, unknown> | null;
    output: Record<string, unknown> | null;
    error: string | null;
  };
  const stepsRes = await pool.query<RunStepRow>(
    'SELECT rs.* FROM run_steps rs WHERE rs.run_id = $1 ORDER BY rs.step_idx ASC',
    [id]
  );

  return {
    run: {
      id: runRes.rows[0].id,
      workflowId: runRes.rows[0].workflow_id,
      triggerId: runRes.rows[0].trigger_id,
      triggerKind: runRes.rows[0].trigger_kind
        ? (runRes.rows[0].trigger_kind as RunRecord['triggerKind'])
        : undefined,
      status: runRes.rows[0].status as RunRecord['status'],
      startedAt: runRes.rows[0].started_at ?? undefined,
      endedAt: runRes.rows[0].ended_at ?? undefined,
      durationMs:
        runRes.rows[0].started_at && runRes.rows[0].ended_at
          ? Date.parse(runRes.rows[0].ended_at) - Date.parse(runRes.rows[0].started_at)
          : undefined,
      inputPayload: runRes.rows[0].input_payload ?? undefined,
      resultPayload: runRes.rows[0].result_payload ?? undefined,
      error: runRes.rows[0].error ?? undefined,
    },
    steps: stepsRes.rows.map(
      (step): RunStepRecord => ({
        id: step.id,
        runId: step.run_id,
        stepIdx: step.step_idx,
        status: step.status as RunStepRecord['status'],
        startedAt: step.started_at ?? undefined,
        endedAt: step.ended_at ?? undefined,
        durationMs: step.started_at && step.ended_at ? Date.parse(step.ended_at) - Date.parse(step.started_at) : undefined,
        input: step.input ?? undefined,
        output: step.output ?? undefined,
        error: step.error ?? undefined,
      })
    ),
  };
};

export const cancelRun = async (id: string, userId?: string) => {
  const ownerId = ensureUser(userId);
  const result = await pool.query(
    "UPDATE runs SET status = 'canceled', ended_at = NOW() FROM workflows w WHERE runs.workflow_id = w.id AND runs.id = $1 AND w.user_id = $2 AND runs.status IN ('queued','running') RETURNING runs.id",
    [id, ownerId]
  );

  return (result.rowCount ?? 0) > 0;
};
