import express from 'express';
import { prisma } from './lib/prisma.js';

const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: 'ok',
      service: 'reachinbox-api',
      database: 'connected',
    });
  } catch (error) {
    console.error('Database health check failed:', error);

    res.status(503).json({
      status: 'error',
      service: 'reachinbox-api',
      database: 'disconnected',
    });
  }
});

app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
});