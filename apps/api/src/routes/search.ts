import { Router } from 'express';

import { searchEmails } from '../lib/elasticsearch.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/emails', async (req, res) => {
  try {
    const tenantId = req.session.tenantId;

    if (!tenantId) {
      res.status(401).json({
        error: 'Tenant not found',
      });
      return;
    }

    const query = String(req.query.q || '').trim();

    if (!query) {
      res.status(400).json({
        error: 'Search query is required',
      });
      return;
    }

    const emails = await searchEmails(tenantId, query);

    res.json({
      emails,
      total: emails.length,
    });
  } catch (error) {
    console.error('Email search failed:', error);

    res.status(500).json({
      error: 'Email search failed',
    });
  }
});

export { router as searchRouter };