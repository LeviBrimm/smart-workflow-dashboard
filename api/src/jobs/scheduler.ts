import { pool } from '../lib/db.js';
import { isDue } from '../lib/cron.js';
import { createRunForTrigger } from '../services/execution.service.js';
import { enqueueRun } from '../services/trigger.service.js';

type ScheduleTriggerRow = {
  id: string;
  workflow_id: string;
  config: { cron?: string };
  status: 'active' | 'inactive';
};

/**
 * Scans schedule triggers and enqueues runs for those whose cron is due.
 * Returns the number of runs queued for observability in logs/tests.
 */
export const runScheduler = async (referenceDate = new Date()): Promise<number> => {
  const triggerRes = await pool.query<ScheduleTriggerRow>(
    `SELECT t.id, t.workflow_id, t.config, w.status
     FROM triggers t
     JOIN workflows w ON w.id = t.workflow_id
     WHERE t.kind = $1`,
    ['schedule']
  );

  const dueTriggers = triggerRes.rows.filter(trigger => {
    const cronExpr = trigger.config?.cron;
    return trigger.status === 'active' && typeof cronExpr === 'string' && isDue(cronExpr, referenceDate);
  });

  for (const trigger of dueTriggers) {
    const runEnvelope = await createRunForTrigger(trigger.id, {
      schedule: { firedAt: referenceDate.toISOString() },
    });
    await enqueueRun(runEnvelope);
  }

  return dueTriggers.length;
};
