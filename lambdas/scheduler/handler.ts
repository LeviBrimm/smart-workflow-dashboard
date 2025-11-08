import { runScheduler } from '../../api/src/jobs/scheduler.js';

export const handler = async () => {
  await runScheduler();
};
