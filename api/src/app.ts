import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { pool } from './lib/db.js';
import { httpLogger, logger } from './lib/logger.js';
import { requireAuth } from './middleware/auth.js';
import workflowsRouter from './routes/workflows.js';
import runsRouter from './routes/runs.js';
import triggersRouter from './routes/triggers.js';
import webhookRouter from './routes/webhook.js';
import authRouter from './routes/auth.js';

dotenv.config();

declare global {
  namespace Express {
    interface Request {
      rawBody?: string;
    }
  }
}

const app = express();
const port = Number(process.env.PORT ?? 4000);
const allowedOrigins = process.env.CORS_ORIGINS?.split(',').map(origin => origin.trim());

app.use(cors({ origin: allowedOrigins ?? '*', credentials: true }));
app.use(
  express.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
      const request = req as express.Request;
      if (request.originalUrl.startsWith('/v1/webhook')) {
        request.rawBody = buf.toString('utf8');
      }
    },
  })
);
app.use(httpLogger);

app.get('/healthz', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', uptime: process.uptime() });
  } catch (error) {
    logger.error(error, 'Health check failed');
    res.status(500).json({ status: 'error', message: 'Database unavailable' });
  }
});

app.use('/v1/auth', authRouter);
app.use('/v1/webhook', webhookRouter);

const authedRouter = express.Router();
authedRouter.use(requireAuth);
authedRouter.use('/workflows', workflowsRouter);
authedRouter.use('/runs', runsRouter);
authedRouter.use('/triggers', triggersRouter);

app.use('/v1', authedRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(err, 'Unhandled error');
  res.status(500).json({ message: 'Unexpected server error' });
});

app.listen(port, () => {
  logger.info({ port }, 'API listening');
});
