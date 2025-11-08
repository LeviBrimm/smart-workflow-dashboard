import dotenv from 'dotenv';
import { runScheduler } from '../jobs/scheduler.js';
import { logger } from '../lib/logger.js';

dotenv.config();

const intervalMs = Number(process.env.SCHEDULER_INTERVAL_MS ?? 60_000);
const runOnce = process.env.SCHEDULER_RUN_ONCE === 'true';

let isRunning = false;

const tick = async () => {
  if (isRunning) {
    logger.warn('Previous scheduler tick still running, skipping this interval.');
    return;
  }

  isRunning = true;
  try {
    const count = await runScheduler();
    logger.info({ count }, 'Scheduler tick complete');
  } catch (error) {
    logger.error(error, 'Scheduler tick failed');
  } finally {
    isRunning = false;
  }
};

const start = async () => {
  if (runOnce) {
    await tick();
    process.exit(0);
    return;
  }

  await tick();
  setInterval(tick, intervalMs);
};

start().catch(error => {
  logger.error(error, 'Scheduler process crashed');
  process.exit(1);
});
