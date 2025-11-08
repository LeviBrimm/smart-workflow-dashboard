import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const bucket = process.env.S3_ARTIFACT_BUCKET;
const region = process.env.REGION ?? 'us-east-1';
const endpoint = process.env.S3_ENDPOINT;

const s3 = new S3Client({
  region,
  endpoint,
  forcePathStyle: Boolean(endpoint),
});

export const writeS3 = async (params: { key: string; body: unknown; contentType?: string }) => {
  if (!bucket) {
    throw new Error('S3_ARTIFACT_BUCKET is not configured');
  }

  const { key, body, contentType = 'application/json' } = params;
  const serializedBody = typeof body === 'string' ? body : JSON.stringify(body, null, 2);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: serializedBody,
    ContentType: contentType,
  });

  await s3.send(command);
  return { bucket, key };
};
