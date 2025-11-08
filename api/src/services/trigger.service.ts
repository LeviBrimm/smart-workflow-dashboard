import crypto from 'node:crypto';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { pool } from '../lib/db.js';
import { createSignature } from '../lib/hmac.js';
import type { RunEnvelope } from './execution.service.js';
import { getNextRun } from '../lib/cron.js';

const queueUrl = process.env.SQS_QUEUE_URL;
const sqsEndpoint = process.env.SQS_ENDPOINT;
const sqsClient = queueUrl
  ? new SQSClient({
      region: process.env.REGION ?? 'us-east-1',
      endpoint: sqsEndpoint,
      useQueueUrlAsEndpoint: false,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'localstack',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'localstack',
      },
    })
  : null;

const ensureQueue = () => {
  if (!queueUrl || !sqsClient) {
    throw new Error('SQS queue not configured');
  }
  return { queueUrl, sqsClient };
};

const ensureUser = (userId?: string) => {
  if (!userId) {
    throw new Error('User context required');
  }
  return userId;
};

export const enqueueRun = async (payload: RunEnvelope) => {
  const { queueUrl: url, sqsClient: client } = ensureQueue();
  await client.send(
    new SendMessageCommand({
      QueueUrl: url,
      MessageBody: JSON.stringify(payload),
    })
  );
};

export const getTriggerWithSecret = async (triggerId: string) => {
  const triggerRes = await pool.query<{ id: string; workflow_id: string; config: { secret?: string } }>(
    'SELECT id, workflow_id, config FROM triggers WHERE id = $1',
    [triggerId]
  );
  return triggerRes.rows[0] ?? null;
};

export const verifyWebhookRequest = async (triggerId: string, rawBody: string, signature?: string) => {
  if (!signature) {
    throw new Error('Missing X-Signature header');
  }
  const trigger = await getTriggerWithSecret(triggerId);
  if (!trigger?.config?.secret) {
    throw new Error('Trigger secret unavailable');
  }
  const expected = createSignature(rawBody, trigger.config.secret);
  if (expected.length !== signature.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
};

type ScheduleTriggerRow = {
  id: string;
  workflow_id: string;
  kind: string;
  config: { cron?: string };
  workflow_name: string;
  workflow_status: string;
};

export type ScheduleTriggerSummary = {
  id: string;
  workflowId: string;
  workflowName: string;
  workflowStatus: string;
  cron?: string;
  nextRunAt?: string;
};

export const listScheduleTriggers = async (userId?: string): Promise<ScheduleTriggerSummary[]> => {
  const ownerId = ensureUser(userId);
  const result = await pool.query<ScheduleTriggerRow>(
    `SELECT t.id, t.workflow_id, t.kind, t.config, w.name as workflow_name, w.status as workflow_status
     FROM triggers t
     JOIN workflows w ON w.id = t.workflow_id
     WHERE t.kind = 'schedule' AND w.user_id = $1`,
    [ownerId]
  );

  return result.rows.map(row => {
    const cronExpr = typeof row.config?.cron === 'string' ? row.config.cron : undefined;
    return {
      id: row.id,
      workflowId: row.workflow_id,
      workflowName: row.workflow_name,
      workflowStatus: row.workflow_status,
      cron: cronExpr,
      nextRunAt: cronExpr ? getNextRun(cronExpr) : undefined,
    };
  });
};
