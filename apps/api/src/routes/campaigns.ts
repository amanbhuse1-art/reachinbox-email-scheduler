import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { emailQueue } from '../lib/email-queue.js';

const router = Router();

router.use(requireAuth);

// Get campaigns
router.get('/', async (req, res) => {
  try {
    const tenantId = req.session.tenantId;

    if (!tenantId) {
      res.status(401).json({
        error: 'Tenant not found',
      });
      return;
    }

    const campaigns = await prisma.campaign.findMany({
      where: {
        tenantId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json({
      campaigns,
    });
  } catch (error) {
    console.error('Failed to fetch campaigns:', error);

    res.status(500).json({
      error: 'Failed to fetch campaigns',
    });
  }
});

// Create and schedule campaign
router.post('/', async (req, res) => {
  try {
    const tenantId = req.session.tenantId;

    if (!tenantId) {
      res.status(401).json({
        error: 'Tenant not found',
      });
      return;
    }

    const {
      name,
      subject,
      body,
      senderId,
      startAt,
      delayMs,
      hourlyLimit,
      recipients,
    } = req.body;

    // Validate required fields
    if (
      !name ||
      !subject ||
      !body ||
      !senderId ||
      !startAt ||
      !Array.isArray(recipients)
    ) {
      res.status(400).json({
        error:
          'name, subject, body, senderId, startAt and recipients are required',
      });
      return;
    }

    // Find sender belonging to the authenticated tenant
    const sender = await prisma.senderAccount.findFirst({
      where: {
        id: senderId,
        tenantId,
        enabled: true,
      },
    });

    if (!sender) {
      res.status(400).json({
        error: 'Sender not found or disabled',
      });
      return;
    }

    // Validate start time
    const campaignStart = new Date(startAt);

    if (Number.isNaN(campaignStart.getTime())) {
      res.status(400).json({
        error: 'Invalid startAt date',
      });
      return;
    }

    // Use sender defaults when values are not provided
    const actualDelayMs =
      Number(delayMs) > 0 ? Number(delayMs) : sender.minDelayMs;

    const actualHourlyLimit =
      Number(hourlyLimit) > 0
        ? Number(hourlyLimit)
        : sender.maxEmailsPerHour;

    // Clean and validate recipients
    const cleanRecipients = [
      ...new Set(
        recipients
          .map((recipient: unknown) => String(recipient).trim().toLowerCase())
          .filter((recipient: string) => recipient.includes('@')),
      ),
    ];

    if (cleanRecipients.length === 0) {
      res.status(400).json({
        error: 'At least one valid recipient is required',
      });
      return;
    }

    // Create campaign
    const campaign = await prisma.campaign.create({
      data: {
        tenantId,
        senderId,
        name: String(name).trim(),
        subject: String(subject).trim(),
        body: String(body),
        startAt: campaignStart,
        delayMs: actualDelayMs,
        hourlyLimit: actualHourlyLimit,
        totalEmails: cleanRecipients.length,
        status: 'SCHEDULED',
      },
    });

    // Create email records and BullMQ jobs
    for (let index = 0; index < cleanRecipients.length; index += 1) {
      const recipient = cleanRecipients[index];

      const scheduledAt = new Date(
        campaignStart.getTime() + index * actualDelayMs,
      );

      const email = await prisma.emailMessage.create({
        data: {
          campaignId: campaign.id,
          tenantId,
          senderId,
          recipient,
          subject: String(subject).trim(),
          body: String(body),
          sequenceNumber: index + 1,
          scheduledAt,
          status: 'SCHEDULED',
          idempotencyKey: `${campaign.id}:${index + 1}:${recipient}`,
        },
      });

      const delay = Math.max(0, scheduledAt.getTime() - Date.now());

      const job = await emailQueue.add(
        'send-email',
        {
          emailMessageId: email.id,
          recipient,
          subject: String(subject).trim(),
          text: String(body),
          from: sender.email,
          senderId,
          campaignId: campaign.id,
        },
        {
          jobId: email.id,
          delay,
        },
      );

      await prisma.emailMessage.update({
        where: {
          id: email.id,
        },
        data: {
          bullJobId: job.id,
        },
      });
    }

    res.status(201).json({
      campaign,
      scheduledEmails: cleanRecipients.length,
    });
  } catch (error) {
    console.error('Failed to create campaign:', error);

    res.status(500).json({
      error: 'Failed to create campaign',
    });
  }
});

export { router as campaignsRouter };