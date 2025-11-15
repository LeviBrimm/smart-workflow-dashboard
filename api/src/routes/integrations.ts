import { Router } from 'express';
import {
  createIntegration,
  deleteIntegration,
  listIntegrations,
  updateIntegration,
} from '../services/integration.service.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const integrations = await listIntegrations(req.user?.id);
    res.json(integrations);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const integration = await createIntegration(req.body, req.user?.id);
    res.status(201).json(integration);
  } catch (error) {
    next(error);
  }
});

router.delete('/:integrationId', async (req, res, next) => {
  try {
    await deleteIntegration(req.params.integrationId, req.user?.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.patch('/:integrationId', async (req, res, next) => {
  try {
    const updated = await updateIntegration(req.params.integrationId, req.body, req.user?.id);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

export default router;
