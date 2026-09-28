import { Worker, DelayedError } from 'bullmq';
import { workerRedis } from './lib/redis.js';
import { sendEmail } from './lib/mailer.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(process.cwd(), '../../.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not configured');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

type EmailJobData = {
  emailMessageId: string;
  recipient: string;
  subject: string;
  text: string;
  from?: string;
  senderId: string;
  campaignId: string;
};

const concurrency = Number(process.env.WORKER_CONCURRENCY) || 5;

/*
 * Redis Lua script.
 *
 * It atomically:
 * 1. Checks the sender's hourly counter.
 * 2. Checks the sender's minimum-delay timestamp.
 * 3. Reserves the next allowed send time.
 *
 * Because this happens inside Redis atomically, multiple worker
 * processes cannot accidentally send above the configured limit.
 */
const reserveSendSlot = `
local count = tonumber(redis.call('GET', KEYS[1]) or '0')
local lastSend = tonumber(redis.call('GET', KEYS[2]) or '0')

local now = tonumber(ARGV[1])
local hourlyLimit = tonumber(ARGV[2])
local minDelayMs = tonumber(ARGV[3])

local hourStart = now - 3600000

-- Remove an expired hourly window.
local windowStart = redis.call('GET', KEYS[3])

if not windowStart or tonumber(windowStart) <= hourStart then
  redis.call('SET', KEYS[3], now)
  redis.call('SET', KEYS[1], '0')
  count = 0
end

local nextAllowed = now

if lastSend + minDelayMs > nextAllowed then
  nextAllowed = lastSend + minDelayMs
end

if count >= hourlyLimit then
  local currentWindowStart = tonumber(redis.call('GET', KEYS[3]) or now)
  local retryAt = currentWindowStart + 3600000

  if retryAt > nextAllowed then
    nextAllowed = retryAt
  end

  return {0, nextAllowed}
end

if nextAllowed > now then
  return {0, nextAllowed}
end

redis.call('INCR', KEYS[1])
redis.call('PEXPIRE', KEYS[1], 3600000)

redis.call('SET', KEYS[2], now)
redis.call('PEXPIRE', KEYS[2], 3600000)

redis.call('PEXPIRE', KEYS[3], 3600000)

return {1, now}
`;

async function reserveSenderSlot(
  senderId: string,
  hourlyLimit: number,
  minDelayMs: number,
) {
  const now = Date.now();

  const countKey = `email-rate:${senderId}:count`;
  const lastSendKey = `email-rate:${senderId}:last-send`;
  const windowKey = `email-rate:${senderId}:window`;

const result = (await workerRedis.eval(
  reserveSendSlot,
  3,
  countKey,
  lastSendKey,
  windowKey,
  String(now),
  String(hourlyLimit),
  String(minDelayMs),
)) as [number, number];

  return {
    allowed: Number(result[0]) === 1,
    nextAllowedAt: Number(result[1]),
  };
}

const emailWorker = new Worker<EmailJobData, { messageId: string }>(
  'email-sending',

  async (job) => {
    console.log(`Processing email job: ${job.id}`);

    const email = await prisma.emailMessage.findUnique({
      where: {
        id: job.data.emailMessageId,
      },
      include: {
        sender: true,
      },
    });

    if (!email) {
      throw new Error(
        `EmailMessage not found: ${job.data.emailMessageId}`,
      );
    }

    // Idempotency: never send an email that was already sent.
    if (email.status === 'SENT') {
      console.log(`Email already sent: ${email.id}`);

      return {
        messageId: email.providerMessageId ?? 'already-sent',
      };
    }

    const hourlyLimit = email.sender.maxEmailsPerHour;
    const minDelayMs = email.sender.minDelayMs;

    /*
     * Reserve a globally shared sender slot before sending.
     *
     * If another worker already used the slot, move this job back
     * to delayed instead of dropping it.
     */
    const slot = await reserveSenderSlot(
      email.senderId,
      hourlyLimit,
      minDelayMs,
    );

    if (!slot.allowed) {
      const delayUntil = Math.max(
        slot.nextAllowedAt,
        Date.now() + 1000,
      );

      console.log(
        `Sender rate limit reached for ${email.sender.email}. ` +
          `Rescheduling job ${job.id} for ${new Date(delayUntil).toISOString()}`,
      );

      await job.moveToDelayed(delayUntil, job.token);

      throw new DelayedError();
    }

    await prisma.emailMessage.update({
      where: {
        id: email.id,
      },
      data: {
        status: 'PROCESSING',
        attempts: {
          increment: 1,
        },
      },
    });

    try {
      const from =
        job.data.from || process.env.ETHEREAL_SMTP_USER;

      if (!from) {
        throw new Error('No sender email configured');
      }

      const info = await sendEmail({
        from,
        to: job.data.recipient,
        subject: job.data.subject,
        text: job.data.text,
      });

      await prisma.emailMessage.update({
        where: {
          id: email.id,
        },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          providerMessageId: info.messageId,
          lastError: null,
        },
      });

      console.log(`Email sent successfully: ${info.messageId}`);

      return {
        messageId: info.messageId,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      await prisma.emailMessage.update({
        where: {
          id: email.id,
        },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          lastError: message,
        },
      });

      console.error(`Email failed: ${email.id}`, message);

      throw error;
    }
  },

  {
    connection: workerRedis,
    concurrency,
  },
);

emailWorker.on('completed', (job) => {
  console.log(`Email job completed: ${job.id}`);
});

emailWorker.on('failed', (job, error) => {
  console.error(
    `Email job failed: ${job?.id}`,
    error.message,
  );
});

emailWorker.on('error', (error) => {
  console.error('Worker error:', error);
});

async function shutdown() {
  console.log('Shutting down worker...');

  await emailWorker.close();
  await prisma.$disconnect();
  await workerRedis.quit();

  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log(
  `ReachInbox worker started with concurrency ${concurrency}`,
);