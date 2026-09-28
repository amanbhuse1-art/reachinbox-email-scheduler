import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

import cors from 'cors';
import express from 'express';

import { ensureEmailIndex } from './lib/elasticsearch.js';
import { emailQueue } from './lib/email-queue.js';
import { prisma } from './lib/prisma.js';
import { redisClient } from './lib/redis.js';
import { sessionMiddleware } from './lib/session.js';

import { requireAuth } from './middleware/auth.js';

import { authRouter } from './routes/auth.js';
import { campaignsRouter } from './routes/campaigns.js';
import { searchRouter } from './routes/search.js';
import { sendersRouter } from './routes/senders.js';

const app = express();

const serverAdapter = new ExpressAdapter();

serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});

const port = Number(process.env.PORT) || 4000;

const frontendUrl =
  process.env.FRONTEND_URL || 'http://localhost:5173';

// Middleware
app.use(
  cors({
    origin: frontendUrl,
    credentials: true,
  }),
);

app.use(express.json());

app.use(sessionMiddleware);

// Routes
app.use('/auth', authRouter);
app.use('/campaigns', campaignsRouter);
app.use('/senders', sendersRouter);
app.use('/search', searchRouter);

// Protected BullMQ dashboard
app.use(
  '/admin/queues',
  requireAuth,
  serverAdapter.getRouter(),
);

// Health check
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: 'ok',
      postgres: 'connected',
      redis: redisClient.isOpen ? 'connected' : 'disconnected',
    });
  } catch (error) {
    console.error('Health check failed:', error);

    res.status(500).json({
      status: 'error',
      postgres: 'disconnected',
      redis: redisClient.isOpen ? 'connected' : 'disconnected',
    });
  }
});

// Start server
async function startServer() {
  try {
    await prisma.$connect();

    if (!redisClient.isOpen) {
      await redisClient.connect();
    }

    await ensureEmailIndex();

    console.log('PostgreSQL connected');
    console.log('Redis connected');
    console.log('Elasticsearch connected');

    app.listen(port, () => {
      console.log(
        `API server running on http://localhost:${port}`,
      );
    });
  } catch (error) {
    console.error('Failed to start API server:', error);
    process.exit(1);
  }
}

startServer();