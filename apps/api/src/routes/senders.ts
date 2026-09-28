import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const tenantId = req.session.tenantId;

    if (!tenantId) {
      res.status(401).json({ error: 'Tenant not found' });
      return;
    }

    let senders = await prisma.senderAccount.findMany({
      where: {
        tenantId,
        enabled: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        smtpHost: true,
        smtpPort: true,
        smtpSecure: true,
        maxEmailsPerHour: true,
        minDelayMs: true,
        enabled: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Create a default Ethereal sender for a newly authenticated tenant.
    if (senders.length === 0) {
      const smtpHost = process.env.ETHEREAL_SMTP_HOST;
      const smtpPort = Number(process.env.ETHEREAL_SMTP_PORT || 587);
      const smtpUsername = process.env.ETHEREAL_SMTP_USER;
      const smtpPassword = process.env.ETHEREAL_SMTP_PASSWORD;

      if (!smtpHost || !smtpUsername || !smtpPassword) {
        res.status(500).json({
          error: 'Ethereal SMTP configuration is missing',
        });
        return;
      }

      const sender = await prisma.senderAccount.create({
        data: {
          tenantId,
          name: 'Ethereal Sender',
          email: smtpUsername,
          smtpHost,
          smtpPort,
          smtpUsername,
          smtpPasswordEncrypted: smtpPassword,
          smtpSecure: false,
          enabled: true,
          maxEmailsPerHour: 200,
          minDelayMs: 2000,
        },
        select: {
          id: true,
          name: true,
          email: true,
          smtpHost: true,
          smtpPort: true,
          smtpSecure: true,
          maxEmailsPerHour: true,
          minDelayMs: true,
          enabled: true,
          createdAt: true,
        },
      });

      senders = [sender];
    }

    res.json({ senders });
  } catch (error) {
    console.error('Failed to load senders:', error);
    res.status(500).json({ error: 'Failed to load senders' });
  }
});

export { router as sendersRouter };