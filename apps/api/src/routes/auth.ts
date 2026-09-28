import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { googleOAuthClient } from '../lib/google.js';
import { prisma } from '../lib/prisma.js';

const router = Router();
router.get('/me', async (req, res) => {
  try {
    if (!req.session.userId || !req.session.tenantId) {
      res.status(401).json({
        authenticated: false,
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: {
        id: req.session.userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      req.session.destroy(() => undefined);

      res.status(401).json({
        authenticated: false,
      });
      return;
    }

    res.json({
      authenticated: true,
      user,
      tenantId: req.session.tenantId,
    });
  } catch (error) {
    console.error('Session check failed:', error);

    res.status(500).json({
      authenticated: false,
      error: 'Failed to check session',
    });
  }
});

router.get('/google', (req, res) => {
  const state = randomBytes(32).toString('hex');

  req.session.oauthState = state;

  const authorizationUrl = googleOAuthClient.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    state,
    prompt: 'select_account',
  });

  res.redirect(authorizationUrl);
});

router.get('/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (typeof code !== 'string' || typeof state !== 'string') {
      res.status(400).json({
        error: 'Missing OAuth code or state',
      });
      return;
    }

    if (!req.session.oauthState || req.session.oauthState !== state) {
      res.status(400).json({
        error: 'Invalid OAuth state',
      });
      return;
    }

    req.session.oauthState = undefined;

    const { tokens } = await googleOAuthClient.getToken(code);

    if (!tokens.id_token) {
      res.status(400).json({
        error: 'Google did not return an ID token',
      });
      return;
    }

    const ticket = await googleOAuthClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email) {
      res.status(400).json({
        error: 'Google account information is incomplete',
      });
      return;
    }

    if (payload.email_verified !== true) {
      res.status(403).json({
        error: 'Google email is not verified',
      });
      return;
    }

    const user = await prisma.user.upsert({
      where: {
        googleId: payload.sub,
      },
      update: {
        name: payload.name ?? payload.email,
        email: payload.email,
        avatarUrl: payload.picture ?? null,
      },
      create: {
        googleId: payload.sub,
        name: payload.name ?? payload.email,
        email: payload.email,
        avatarUrl: payload.picture ?? null,
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
          name: `${user.name}'s Workspace`,
          ownerUserId: user.id,
        },
      });
    }

    req.session.userId = user.id;
    req.session.tenantId = tenant.id;

    res.redirect(
      `${process.env.FRONTEND_URL}/?login=success`,
    );
  } catch (error) {
    console.error('Google OAuth callback failed:', error);

    res.status(500).json({
      error: 'Google authentication failed',
    });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error('Logout failed:', error);

      res.status(500).json({
        error: 'Logout failed',
      });
      return;
    }

    res.clearCookie(process.env.SESSION_NAME || 'reachinbox.sid');

    res.json({
      success: true,
    });
  });
});

export { router as authRouter };
