import { resolve } from 'node:path';
import { config } from 'dotenv';
import { createClient } from 'redis';

config({
  path: resolve(process.cwd(), '../../.env'),
});

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error('REDIS_URL environment variable is not set');
}

const redisClient = createClient({
  url: redisUrl,
});

redisClient.on('error', (error) => {
  console.error('Redis client error:', error);
});

export { redisClient };
