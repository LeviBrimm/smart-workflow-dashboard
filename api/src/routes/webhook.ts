import { Router } from 'express';
import { enqueueRun, verifyWebhookRequest } from '../services/trigger.service.js';
import { createRunForTrigger } from '../services/execution.service.js';

const router = Router();

router.post('/:triggerId', async (req, res, next) => {
  try {
    const rawBody = req.rawBody ?? JSON.stringify(req.body ?? {});
    const signature = req.header('x-signature');
    const isValid = await verifyWebhookRequest(req.params.triggerId, rawBody, signature ?? undefined);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid signature' });
    }

    let payload: Record<string, unknown> = {};
    if (rawBody) {
      try {
        payload = JSON.parse(rawBody);
      } catch (error) {
        return res.status(400).json({ message: 'Invalid JSON payload', details: String(error) });
      }
    }

    const runEnvelope = await createRunForTrigger(req.params.triggerId, payload);
    await enqueueRun(runEnvelope);
    res.json({ ok: true, runId: runEnvelope.runId });
  } catch (error) {
    next(error);
  }
});

export default router;
