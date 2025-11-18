import type { ActionKind } from '../types/workflow.js';

type TemplateFieldType = 'text' | 'textarea' | 'select';

export type TemplateFieldOption = {
  value: string;
  label: string;
};

export type TemplateField = {
  id: string;
  label: string;
  type: TemplateFieldType;
  required?: boolean;
  placeholder?: string;
  helperText?: string;
  options?: TemplateFieldOption[];
  defaultValue?: string;
};

export type TemplateDefinition = {
  id: string;
  name: string;
  summary: string;
  icon?: string;
  recommendedIntegrations?: Array<'slack_webhook' | 'openai'>;
  fields: TemplateField[];
  workflow: {
    name: string;
    description?: string;
    steps: Array<{
      actionKind: ActionKind;
      config: Record<string, unknown>;
    }>;
    triggers: Array<{
      kind: 'schedule' | 'webhook';
      config: Record<string, unknown>;
    }>;
  };
};

const templates: TemplateDefinition[] = [
  {
    id: 'ai_follow_up_slack',
    name: 'AI follow-up into Slack',
    summary: 'Call an external API, summarize with AI, then post the result into Slack.',
    icon: '🤖',
    recommendedIntegrations: ['openai', 'slack_webhook'],
    fields: [
      {
        id: 'httpEndpoint',
        label: 'Source API URL',
        type: 'text',
        required: true,
        placeholder: 'https://api.example.com/leads',
        helperText: 'Endpoint returning the payload you want summarized',
      },
      {
        id: 'openAiTone',
        label: 'AI tone',
        type: 'select',
        options: [
          { value: 'friendly', label: 'Friendly' },
          { value: 'formal', label: 'Formal' },
        ],
        defaultValue: 'friendly',
      },
      {
        id: 'slackChannel',
        label: 'Slack channel',
        type: 'text',
        placeholder: '#updates',
        required: true,
      },
    ],
    workflow: {
      name: 'AI follow-up summary',
      description: 'Pull recent data, summarize with AI, and share in Slack.',
      steps: [
        {
          actionKind: 'http_request',
          config: {
            method: 'GET',
            url: '{{httpEndpoint}}',
          },
        },
        {
          actionKind: 'generate_ai_content',
          config: {
            prompt: 'Summarize the latest lead update in a {{openAiTone}} voice.',
          },
        },
        {
          actionKind: 'send_slack_message',
          config: {
            channel: '{{slackChannel}}',
            text: 'New summary: {{step.1.output}}',
          },
        },
      ],
      triggers: [
        {
          kind: 'schedule',
          config: { cron: '0 9 * * 1-5', timezone: 'UTC' },
        },
      ],
    },
  },
  {
    id: 'simple_slack_alert',
    name: 'Simple Slack alert',
    summary: 'Hit a webhook and fan it out to Slack with minimal setup.',
    icon: '📣',
    recommendedIntegrations: ['slack_webhook'],
    fields: [
      {
        id: 'alertChannel',
        label: 'Slack channel',
        type: 'text',
        placeholder: '#alerts',
        required: true,
      },
      {
        id: 'alertDescription',
        label: 'Alert description',
        type: 'textarea',
        placeholder: 'Describe what this alert is for',
      },
    ],
    workflow: {
      name: 'Slack webhook alert',
      description: 'Simple webhook -> Slack passthrough.',
      steps: [
        {
          actionKind: 'send_slack_message',
          config: {
            channel: '{{alertChannel}}',
            text: 'Alert: {{payload.message}}',
          },
        },
      ],
      triggers: [
        {
          kind: 'webhook',
          config: { secret: 'replace-me' },
        },
      ],
    },
  },
  {
    id: 'webhook_email_alert',
    name: 'Webhook → Email',
    summary: 'Accept POST payloads and send them out via email with your own subject line.',
    icon: '✉️',
    fields: [
      {
        id: 'recipientEmail',
        label: 'Recipient email',
        type: 'text',
        placeholder: 'ops@example.com',
        required: true,
      },
      {
        id: 'emailSubject',
        label: 'Email subject',
        type: 'text',
        placeholder: 'New webhook alert',
        required: true,
      },
      {
        id: 'emailBody',
        label: 'Email body',
        type: 'textarea',
        placeholder: 'Describe what happened…',
        required: true,
      },
    ],
    workflow: {
      name: 'Webhook email alert',
      description: 'Forward webhook payloads directly to your inbox.',
      steps: [
        {
          actionKind: 'send_email',
          config: {
            to: '{{recipientEmail}}',
            subject: '{{emailSubject}}',
            body: '{{emailBody}}',
          },
        },
      ],
      triggers: [
        {
          kind: 'webhook',
          config: { secret: 'email-webhook-secret' },
        },
      ],
    },
  },
  {
    id: 'daily_s3_backup',
    name: 'Daily S3 backup',
    summary: 'Run on a cron schedule and drop a JSON payload into S3.',
    icon: '🗄️',
    fields: [
      {
        id: 'bucketName',
        label: 'Bucket name',
        type: 'text',
        placeholder: 'workflow-artifacts',
        required: true,
      },
      {
        id: 'objectPrefix',
        label: 'Object prefix',
        type: 'text',
        placeholder: 'backups/daily-',
      },
    ],
    workflow: {
      name: 'Daily backup to S3',
      description: 'Write a JSON blob to S3 every morning.',
      steps: [
        {
          actionKind: 'write_s3',
          config: {
            bucket: '{{bucketName}}',
            key: '{{objectPrefix}}backup.json',
            body: { message: 'Hello from Smart Workflow' },
          },
        },
      ],
      triggers: [
        {
          kind: 'schedule',
          config: { cron: '0 7 * * *', timezone: 'UTC' },
        },
      ],
    },
  },
  {
    id: 'weekly_finance_summary',
    name: 'Weekly Finance Digest',
    summary: 'Fetch numbers, have AI summarize them, and blast the summary into Slack every week.',
    icon: '📊',
    recommendedIntegrations: ['openai', 'slack_webhook'],
    fields: [
      {
        id: 'metricsApi',
        label: 'Metrics API endpoint',
        type: 'text',
        placeholder: 'https://api.example.com/finance/weekly',
        required: true,
      },
      {
        id: 'slackChannel',
        label: 'Slack channel',
        type: 'text',
        placeholder: '#finance',
        required: true,
      },
    ],
    workflow: {
      name: 'Weekly finance summary',
      description: 'Pull latest metrics, summarize with AI, send to Slack.',
      steps: [
        {
          actionKind: 'http_request',
          config: {
            method: 'GET',
            url: '{{metricsApi}}',
          },
        },
        {
          actionKind: 'generate_ai_content',
          config: {
            prompt:
              'Summarize the following finance metrics in 3 bullet points with emojis and list any risks or anomalies:\n\n{{step.0.output}}',
            temperature: 0.4,
          },
        },
        {
          actionKind: 'send_slack_message',
          config: {
            channel: '{{slackChannel}}',
            text: '*Weekly Finance Digest*\n{{step.1.output}}',
          },
        },
      ],
      triggers: [
        {
          kind: 'schedule',
          config: { cron: '0 12 * * 1', timezone: 'UTC' },
        },
      ],
    },
  },
  {
    id: 'client_outreach_ai',
    name: 'AI Client Outreach',
    summary: 'Draft tailored outreach emails using AI and send them to your client list.',
    icon: '📧',
    recommendedIntegrations: ['openai'],
    fields: [
      {
        id: 'clientListUrl',
        label: 'Client list endpoint',
        type: 'text',
        placeholder: 'https://api.example.com/clients',
        required: true,
      },
      {
        id: 'senderEmail',
        label: 'From email',
        type: 'text',
        placeholder: 'you@example.com',
        required: true,
      },
    ],
    workflow: {
      name: 'AI client outreach',
      description: 'Fetch clients, craft custom outreach copy with AI, send emails.',
      steps: [
        {
          actionKind: 'http_request',
          config: {
            method: 'GET',
            url: '{{clientListUrl}}',
          },
        },
        {
          actionKind: 'generate_ai_content',
          config: {
            prompt:
              'For each client below, write a short check-in email referencing their name and latest project.\n\n{{step.0.output}}',
            temperature: 0.5,
          },
        },
        {
          actionKind: 'send_email',
          config: {
            to: '{{payload.clientEmail}}',
            subject: 'Checking in from your automation studio',
            body: '{{step.1.output}}',
            from: '{{senderEmail}}',
          },
        },
      ],
      triggers: [
        {
          kind: 'schedule',
          config: { cron: '0 15 * * 2', timezone: 'UTC' },
        },
      ],
    },
  },
];

export const getTemplates = () => templates;
export default templates;
