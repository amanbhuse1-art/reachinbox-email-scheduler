import { resolve } from 'node:path';
import { config } from 'dotenv';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

config({
  path: resolve(process.cwd(), '../../.env'),
});

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error('REDIS_URL environment variable is not set');
}

const queueRedis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});

export const emailQueue = new Queue('email-sending', {
  connection: queueRedis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});