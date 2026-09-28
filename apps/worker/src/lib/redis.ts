import { resolve } from 'node:path';
import { config } from 'dotenv';
import { Redis } from 'ioredis';

config({
  path: resolve(process.cwd(), '../../.env'),
});

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error('REDIS_URL environment variable is not set');
}

export const workerRedis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});