import crypto from 'node:crypto';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { pool } from '../lib/db.js';
import { createSignature } from '../lib/hmac.js';
import type { RunEnvelope } from './execution.service.js';

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
