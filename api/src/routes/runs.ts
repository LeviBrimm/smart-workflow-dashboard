import { Router } from 'express';
import { getRunDetail, cancelRun } from '../services/run.service.js';

const router = Router();

router.get('/:id', async (req, res) => {
  const run = await getRunDetail(req.params.id, req.user?.id);
  if (!run) {
    return res.status(404).json({ message: 'Run not found' });
  }
  res.json(run);
});

router.post('/:id/cancel', async (req, res) => {
  const success = await cancelRun(req.params.id, req.user?.id);
  if (!success) {
    return res.status(400).json({ message: 'Unable to cancel run' });
  }
  res.json({ ok: true });
});

export default router;
