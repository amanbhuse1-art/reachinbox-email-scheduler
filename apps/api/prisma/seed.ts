import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log('Starting database seed...');

  const user = await prisma.user.upsert({
    where: {
      email: 'demo@reachinbox.local',
    },
    update: {
      name: 'Demo User',
      avatarUrl: null,
    },
    create: {
      googleId: 'demo-google-id-001',
      name: 'Demo User',
      email: 'demo@reachinbox.local',
      avatarUrl: null,
    },
  });

  let tenant = await prisma.tenant.findFirst({
    where: {
      ownerUserId: user.id,
    },
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: 'Demo Workspace',
        ownerUserId: user.id,
      },
    });
  }

  const senders = [
    {
      name: 'Demo Sender One',
      email: 'sender1@ethereal.email',
    },
    {
      name: 'Demo Sender Two',
      email: 'sender2@ethereal.email',
    },
  ];

  for (const sender of senders) {
    const existingSender = await prisma.senderAccount.findFirst({
      where: {
        tenantId: tenant.id,
        email: sender.email,
      },
    });

    if (!existingSender) {
      await prisma.senderAccount.create({
        data: {
          tenantId: tenant.id,
          name: sender.name,
          email: sender.email,
          smtpHost: 'smtp.ethereal.email',
          smtpPort: 587,
          smtpUsername: 'development-placeholder',
          smtpPasswordEncrypted: 'development-placeholder',
          smtpSecure: false,
          enabled: true,
          maxEmailsPerHour: 200,
          minDelayMs: 2000,
        },
      });
    }
  }

  console.log(`User: ${user.email}`);
  console.log(`Tenant: ${tenant.name}`);
  console.log('Demo senders: sender1@ethereal.email, sender2@ethereal.email');
  console.log('Database seed completed successfully.');
}

main()
  .catch((error) => {
    console.error('Database seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });