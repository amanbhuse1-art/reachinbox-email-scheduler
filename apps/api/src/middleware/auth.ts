import type { NextFunction, Request, Response } from 'express';

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.session.userId || !req.session.tenantId) {
    res.status(401).json({
      error: 'Authentication required',
    });
    return;
  }

  next();
}