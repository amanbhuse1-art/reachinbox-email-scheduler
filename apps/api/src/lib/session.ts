import { resolve } from 'node:path';
import { config } from 'dotenv';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { redisClient } from './redis.js';

config({
  path: resolve(process.cwd(), '../../.env'),
});

const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret) {
  throw new Error('SESSION_SECRET environment variable is not set');
}

export const sessionMiddleware = session({
  store: new RedisStore({
    client: redisClient,
  }),
  secret: sessionSecret,
  name: process.env.SESSION_NAME || 'reachinbox.sid',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
});
