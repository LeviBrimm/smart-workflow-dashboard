import { Router } from 'express';
import { enqueueRun, getTriggerWithSecret, listScheduleTriggers } from '../services/trigger.service.js';
import { createRunForTrigger } from '../services/execution.service.js';

const router = Router();

router.post('/:id/test', async (req, res) => {
  const trigger = await getTriggerWithSecret(req.params.id);
  if (!trigger) {
    return res.status(404).json({ message: 'Trigger not found' });
  }

  const runEnvelope = await createRunForTrigger(trigger.id, req.body ?? {});
  await enqueueRun(runEnvelope);

  res.json({ message: 'Trigger test enqueued', runId: runEnvelope.runId });
});

router.get('/schedules', async (req, res) => {
  const schedules = await listScheduleTriggers(req.user?.id);
  res.json(schedules);
});

export default router;
