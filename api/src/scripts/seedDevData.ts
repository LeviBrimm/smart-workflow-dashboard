import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { pool } from '../lib/db.js';
import { encryptSecret } from '../lib/secrets.js';

const devUserId = process.env.DEV_USER_ID ?? '11111111-1111-1111-1111-111111111111';
const devUserEmail = process.env.DEV_USER_EMAIL ?? 'local@example.com';
const encryptionKey = process.env.SECRET_ENCRYPTION_KEY;

if (!encryptionKey) {
  throw new Error('SECRET_ENCRYPTION_KEY must be set to seed sample data.');
}

const ensureUser = async () => {
  await pool.query(
    `INSERT INTO users (id, email, cognito_sub)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, cognito_sub = EXCLUDED.cognito_sub`,
    [devUserId, devUserEmail, devUserId]
  );
  console.log(`Ensured dev user ${devUserEmail}`);
};

const ensureIntegration = async (options: {
  name: string;
  type: 'slack_webhook' | 'openai';
  secret: string;
  config?: Record<string, unknown>;
}) => {
  const existing = await pool.query('SELECT id FROM user_integrations WHERE user_id = $1 AND name = $2', [
    devUserId,
    options.name,
  ]);
  if (existing.rowCount) {
    console.log(`Integration already exists: ${options.name}`);
    return existing.rows[0].id as string;
  }
  const encrypted = encryptSecret(options.secret);
  const { rows } = await pool.query(
    `INSERT INTO user_integrations (user_id, name, type, config, secret_encrypted)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [devUserId, options.name, options.type, options.config ?? {}, encrypted]
  );
  const integrationId = rows[0].id as string;
  console.log(`Created integration ${options.name}`);
  return integrationId;
};

const ensureWorkflow = async (
  name: string,
  description: string,
  steps: Array<{ idx: number; actionKind: string; config: Record<string, unknown> }>,
  triggers: Array<{ kind: 'schedule' | 'webhook'; config: Record<string, unknown> }>
) => {
  const existing = await pool.query('SELECT id FROM workflows WHERE user_id = $1 AND name = $2', [devUserId, name]);
  let workflowId: string;
  if (existing.rowCount) {
    workflowId = existing.rows[0].id as string;
    await pool.query('UPDATE workflows SET description = $2, updated_at = now() WHERE id = $1', [
      workflowId,
      description,
    ]);
    await pool.query('DELETE FROM run_steps WHERE run_id IN (SELECT id FROM runs WHERE workflow_id = $1)', [workflowId]);
    await pool.query('UPDATE runs SET trigger_id = NULL WHERE trigger_id IN (SELECT id FROM triggers WHERE workflow_id = $1)', [
      workflowId,
    ]);
    await pool.query('DELETE FROM runs WHERE workflow_id = $1', [workflowId]);
    await pool.query('DELETE FROM steps WHERE workflow_id = $1', [workflowId]);
    await pool.query('DELETE FROM triggers WHERE workflow_id = $1', [workflowId]);
  } else {
    const inserted = await pool.query(
      `INSERT INTO workflows (user_id, name, description, status)
       VALUES ($1, $2, $3, 'inactive')
       RETURNING id`,
      [devUserId, name, description]
    );
    workflowId = inserted.rows[0].id as string;
  }

  for (const step of steps) {
    await pool.query(
      `INSERT INTO steps (workflow_id, idx, action_kind, config)
       VALUES ($1, $2, $3, $4)`,
      [workflowId, step.idx, step.actionKind, step.config]
    );
  }

  const triggerIds = new Map<'schedule' | 'webhook', string>();
  for (const trigger of triggers) {
    const result = await pool.query(
      `INSERT INTO triggers (workflow_id, kind, config)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [workflowId, trigger.kind, trigger.config]
    );
    triggerIds.set(trigger.kind, result.rows[0].id as string);
  }

  console.log(`Seeded workflow "${name}" with ${steps.length} steps and ${triggers.length} triggers.`);
  return { workflowId, triggerIds };
};

const seedRuns = async (workflowId: string, triggerId?: string) => {
  await pool.query('DELETE FROM run_steps WHERE run_id IN (SELECT id FROM runs WHERE workflow_id = $1)', [workflowId]);
  await pool.query('DELETE FROM runs WHERE workflow_id = $1', [workflowId]);
  const now = Date.now();
  const runs = [
    {
      status: 'success',
      startedAt: new Date(now - 1000 * 60 * 60),
      durationMs: 4200,
      result_payload: { summary: 'Processed 18 leads' },
    },
    {
      status: 'failed',
      startedAt: new Date(now - 1000 * 60 * 160),
      durationMs: 2000,
      error: 'Slack API returned 500',
    },
    {
      status: 'running',
      startedAt: new Date(now - 1000 * 60 * 5),
      durationMs: null,
    },
  ];

  const runIds: string[] = [];
  for (const run of runs) {
    const endedAt = run.durationMs ? new Date(run.startedAt.getTime() + run.durationMs) : null;
    const inserted = await pool.query(
      `INSERT INTO runs (id, workflow_id, trigger_id, status, started_at, ended_at, result_payload, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [randomUUID(), workflowId, triggerId ?? null, run.status, run.startedAt, endedAt, run.result_payload ?? null, run.error ?? null]
    );
    runIds.push(inserted.rows[0].id as string);
  }
  if (runIds[0]) {
    await pool.query(
      `INSERT INTO run_steps (run_id, step_idx, status, started_at, ended_at)
       VALUES ($1, 0, 'success', $2, $3)`,
      [runIds[0], new Date(now - 1000 * 60 * 60), new Date(now - 1000 * 60 * 60 + 2000)]
    );
  }
  if (runIds[1]) {
    await pool.query(
      `INSERT INTO run_steps (run_id, step_idx, status, started_at, ended_at, error)
       VALUES ($1, 0, 'failed', $2, $3, $4)`,
      [runIds[1], new Date(now - 1000 * 60 * 160), new Date(now - 1000 * 60 * 160 + 1500), 'HTTP 500']
    );
  }
  if (runIds[2]) {
    await pool.query(
      `INSERT INTO run_steps (run_id, step_idx, status, started_at)
       VALUES ($1, 0, 'running', $2)`,
      [runIds[2], new Date(now - 1000 * 60 * 5)]
    );
  }
  console.log('Seeded sample run history');
};

const main = async () => {
  await ensureUser();

  const slackIntegrationId = await ensureIntegration({
    name: 'Demo Slack Alerts',
    type: 'slack_webhook',
    secret: 'https://hooks.slack.com/services/demo/demo/demo',
    config: { channel: '#workflow-alerts' },
  });

  const openAIIntegrationId = await ensureIntegration({
    name: 'Demo OpenAI',
    type: 'openai',
    secret: 'sk-demo-123456789',
  });

  const { workflowId, triggerIds } = await ensureWorkflow(
    'Demo Campaign Follow-up',
    'Example workflow showing HTTP + AI + Slack actions',
    [
      {
        idx: 0,
        actionKind: 'http_request',
        config: {
          method: 'POST',
          url: 'https://api.example.com/leads',
          body: { email: 'demo@example.com', plan: 'pro' },
        },
      },
      {
        idx: 1,
        actionKind: 'generate_ai_content',
        config: {
          integrationId: openAIIntegrationId,
          prompt: 'Draft a personalized follow-up for demo@example.com',
          temperature: 0.3,
        },
      },
      {
        idx: 2,
        actionKind: 'send_slack_message',
        config: {
          integrationId: slackIntegrationId,
          channel: '#workflow-alerts',
          text: 'Sent AI-crafted follow-up to demo@example.com',
        },
      },
    ],
    [
      { kind: 'schedule', config: { cron: '0 14 * * 1-5', timezone: 'UTC' } },
      { kind: 'webhook', config: { secret: 'demo-webhook-secret' } },
    ]
  );

  await seedRuns(workflowId, triggerIds.get('schedule'));

  console.log('✅ Dev database seeded with sample data.');
  await pool.end();
};

main().catch(error => {
  console.error('Seed failed', error);
  process.exit(1);
});
