import { Pool } from 'pg';
import { sendEmail, type EmailConfig } from '../executors/sendEmail.js';
import { executeHttpRequest, type HttpConfig } from '../executors/httpRequest.js';
import { writeS3 } from '../executors/writeS3.js';
import { resolveTemplates } from '../lib/templates.js';

type ActionKind = 'send_email' | 'http_request' | 'write_s3';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

type Executor = (config: Record<string, unknown>, input: Record<string, unknown>, runId: string) => Promise<unknown>;

const actionMap: Record<ActionKind, Executor> = {
  send_email: async config => sendEmail(config as EmailConfig),
  http_request: async (config, input) => executeHttpRequest(config as HttpConfig, input),
  write_s3: async (config, input, runId) => {
    const key = typeof config.key === 'string' && config.key.length ? config.key : `${runId}.json`;
    const body = config.body ?? input;
    return writeS3({
      key,
      body,
      contentType: typeof config.contentType === 'string' ? config.contentType : undefined,
    });
  },
};

export interface SQSPayload {
  runId: string;
  workflowId: string;
  userId: string;
  triggerId: string;
  steps: Array<{ idx: number; action: ActionKind; config: Record<string, unknown> }>;
  input: { payload: Record<string, unknown> };
}

export const processRunRecords = async (records: Array<{ body: string }>): Promise<void> => {
  for (const record of records) {
    const payload = JSON.parse(record.body) as SQSPayload;
    const client = await pool.connect();
    try {
      await client.query('UPDATE runs SET status = $1, started_at = NOW() WHERE id = $2', ['running', payload.runId]);
      let lastOutput = payload.input?.payload ?? {};
      for (const step of payload.steps) {
        const stepInsert = await client.query<{ id: string }>(
          'INSERT INTO run_steps (id, run_id, step_idx, status, started_at) VALUES (gen_random_uuid(), $1, $2, $3, NOW()) RETURNING id',
          [payload.runId, step.idx, 'running']
        );

        const executor = actionMap[step.action];
        const templateContext = {
          runId: payload.runId,
          workflowId: payload.workflowId,
          triggerId: payload.triggerId,
          userId: payload.userId,
          input: payload.input?.payload ?? {},
          steps: lastOutput,
        };
        const resolvedConfig = resolveTemplates(step.config, templateContext);
        try {
          const output = await executor(resolvedConfig, lastOutput, payload.runId);
          lastOutput = { ...lastOutput, [`step_${step.idx}`]: output };
          await client.query('UPDATE run_steps SET status = $1, ended_at = NOW(), output = $2 WHERE id = $3', [
            'success',
            output,
            stepInsert.rows[0].id,
          ]);
        } catch (error) {
          await client.query('UPDATE run_steps SET status = $1, ended_at = NOW(), error = $2 WHERE id = $3', [
            'failed',
            String(error),
            stepInsert.rows[0].id,
          ]);
          throw error;
        }
      }

      await client.query('UPDATE runs SET status = $1, ended_at = NOW(), result_payload = $2 WHERE id = $3', [
        'success',
        lastOutput,
        payload.runId,
      ]);
    } catch (error) {
      await pool.query('UPDATE runs SET status = $1, error = $2, ended_at = NOW() WHERE id = $3', [
        'failed',
        String(error),
        payload.runId,
      ]);
    } finally {
      client.release();
    }
  }
};
