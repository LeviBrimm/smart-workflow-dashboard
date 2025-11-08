import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const region = process.env.REGION ?? 'us-east-1';
const endpoint = process.env.SES_ENDPOINT;
const defaultSender = process.env.SES_SENDER ?? 'noreply@example.com';
const configurationSet = process.env.SES_CONFIGURATION_SET;

const sesClient = new SESClient({
  region,
  endpoint,
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
});

export type EmailConfig = {
  to: string;
  subject: string;
  body: string;
};

export const sendEmail = async (config: EmailConfig) => {
  const command = new SendEmailCommand({
    Source: defaultSender,
    Destination: { ToAddresses: [config.to] },
    Message: {
      Subject: { Data: config.subject },
      Body: { Html: { Data: config.body } },
    },
    ConfigurationSetName: configurationSet,
  });

  const response = await sesClient.send(command);
  return { messageId: response.MessageId };
};
