import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';

export type AdminRequest = Request & {
  admin?: { telegramId?: number };
};

/**
 * Admin guard: accepts either:
 * 1. Header `x-admin-token: <ADMIN_TOKEN>` (env ADMIN_TOKEN)
 * 2. Telegram initData with telegram_id matching env.ADMIN_TELEGRAM_ID (optional)
 */
export function adminRequired(req: AdminRequest, res: Response, next: NextFunction) {
  const headerToken = req.header('x-admin-token');
  if (headerToken && env.ADMIN_TOKEN && headerToken === env.ADMIN_TOKEN) {
    return next();
  }

  const telegramId = (req as unknown as { telegram?: { user: { id: number } } }).telegram?.user?.id;
  if (telegramId && env.ADMIN_TELEGRAM_ID && telegramId === env.ADMIN_TELEGRAM_ID) {
    return next();
  }

  return res.status(401).json({ error: 'admin access required' });
}
