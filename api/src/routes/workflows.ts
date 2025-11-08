import { Router } from 'express';
import { z } from 'zod';
import {
  listWorkflows,
  getWorkflowDetail,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  setWorkflowStatus,
} from '../services/workflow.service.js';
import { listWorkflowRuns } from '../services/run.service.js';

const router = Router();

const stepSchema = z.object({
  id: z.string().optional(),
  idx: z.number().int().nonnegative(),
  actionKind: z.enum(['send_email', 'http_request', 'write_s3']),
  config: z.record(z.any()),
});

const triggerSchema = z.object({
  id: z.string().optional(),
  kind: z.enum(['schedule', 'webhook']),
  config: z.record(z.any()),
});

const workflowPayloadSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive']).default('inactive'),
  steps: z.array(stepSchema),
  triggers: z.array(triggerSchema),
});

router.get('/', async (req, res) => {
  const userId = req.user?.id;
  const workflows = await listWorkflows(userId);
  res.json(workflows);
});

router.get('/:id', async (req, res) => {
  const userId = req.user?.id;
  const workflow = await getWorkflowDetail(req.params.id, userId);
  if (!workflow) {
    return res.status(404).json({ message: 'Workflow not found' });
  }
  res.json(workflow);
});

router.get('/:id/runs', async (req, res) => {
  const runs = await listWorkflowRuns(
    req.params.id,
    req.user?.id,
    req.query.status as string | undefined,
    req.query.limit ? Number(req.query.limit) : undefined,
    req.query.cursor as string | undefined
  );
  res.json(runs);
});

router.post('/', async (req, res) => {
  const userId = req.user?.id;
  const payload = workflowPayloadSchema.parse(req.body);
  const workflow = await createWorkflow(payload, userId);
  res.status(201).json(workflow);
});

router.put('/:id', async (req, res) => {
  const userId = req.user?.id;
  const payload = workflowPayloadSchema.partial().parse(req.body);
  const workflow = await updateWorkflow(req.params.id, payload, userId);
  res.json(workflow);
});

router.post('/:id/activate', async (req, res) => {
  const workflow = await setWorkflowStatus(req.params.id, 'active', req.user?.id);
  res.json(workflow);
});

router.post('/:id/deactivate', async (req, res) => {
  const workflow = await setWorkflowStatus(req.params.id, 'inactive', req.user?.id);
  res.json(workflow);
});

router.delete('/:id', async (req, res) => {
  await deleteWorkflow(req.params.id, req.user?.id);
  res.status(204).send();
});

export default router;
