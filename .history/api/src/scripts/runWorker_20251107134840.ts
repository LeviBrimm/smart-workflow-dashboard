 import dotenv from 'dotenv';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { processRunRecords } from '../services/run-processor.js';

dotenv.config();

const queueUrl = process.env.SQS_QUEUE_URL;

if (!queueUrl) {
  console.error('SQS_QUEUE_URL is not configured');
  process.exit(1);
}

const sqs = new SQSClient({
  region: process.env.REGION ?? 'us-east-1',
  endpoint: process.env.SQS_ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'localstack',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'localstack',
  },
});

const poll = async (): Promise<void> => {
  try {
    const response = await sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 5,
        WaitTimeSeconds: 10,
        AttributeNames: ['All'],
      })
    );

    const messages = response.Messages ?? [];
    if (messages.length) {
      await processRunRecords(messages.map(msg => ({ body: msg.Body ?? '' })));
      await Promise.all(
        messages.map(msg =>
          msg.ReceiptHandle
            ? sqs.send(new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: msg.ReceiptHandle }))
            : Promise.resolve()
        )
      );
      console.log(`Processed ${messages.length} message(s)`);
    }
  } catch (error) {
    console.error('Worker error', error);
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  setImmediate(() => {
    poll().catch(workerError => {
      console.error('Worker loop error', workerError);
    });
  });
};

poll().catch(error => {
  console.error('Fatal worker error', error);
  process.exit(1);
});
