import { Router } from 'express';
import templates from '../templates/catalog.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json(templates);
});

export default router;
