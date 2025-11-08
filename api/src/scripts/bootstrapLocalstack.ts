import 'dotenv/config';
import { SQSClient, CreateQueueCommand } from '@aws-sdk/client-sqs';
import { S3Client, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';

const required = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}`);
  }
  return value;
};

const REGION = required('REGION');
const SQS_QUEUE_URL = required('SQS_QUEUE_URL');
const S3_BUCKET = required('S3_ARTIFACT_BUCKET');
const AWS_ACCESS_KEY_ID = required('AWS_ACCESS_KEY_ID');
const AWS_SECRET_ACCESS_KEY = required('AWS_SECRET_ACCESS_KEY');

const credentials = {
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
};

const normalizeEndpoint = (endpoint?: string) => {
  if (!endpoint) return undefined;
  try {
    const url = new URL(endpoint);
    const overrideHost = process.env.LOCALSTACK_HOST_OVERRIDE ?? 'localhost';
    if (url.hostname === 'localstack' && overrideHost) {
      url.hostname = overrideHost;
    }
    return url.toString();
  } catch {
    return endpoint;
  }
};

const sqs = new SQSClient({
  region: REGION,
  endpoint: normalizeEndpoint(process.env.SQS_ENDPOINT),
  credentials,
});

const s3 = new S3Client({
  region: REGION,
  endpoint: normalizeEndpoint(process.env.S3_ENDPOINT),
  forcePathStyle: true,
  credentials,
});

const getQueueName = () => {
  const url = new URL(SQS_QUEUE_URL);
  const parts = url.pathname.split('/').filter(Boolean);
  return parts[parts.length - 1];
};

const ensureQueue = async () => {
  const QueueName = getQueueName();
  await sqs.send(new CreateQueueCommand({ QueueName }));
  console.log(`Ensured SQS queue: ${QueueName}`);
};

const ensureBucket = async () => {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
    console.log(`S3 bucket already exists: ${S3_BUCKET}`);
    return;
  } catch {
    // fall through and attempt create
  }

  try {
    await s3.send(new CreateBucketCommand({ Bucket: S3_BUCKET }));
    console.log(`Created S3 bucket: ${S3_BUCKET}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('BucketAlreadyOwnedByYou') || message.includes('BucketAlreadyExists')) {
      console.log(`S3 bucket already owned: ${S3_BUCKET}`);
      return;
    }
    throw err;
  }
};

await ensureQueue();
await ensureBucket();
