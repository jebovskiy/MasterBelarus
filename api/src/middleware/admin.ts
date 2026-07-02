import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { validateTelegramWebAppData } from '../services/telegram.js';

export type AdminRequest = Request & {
  admin?: { telegramId?: number };
};

/**
 * Admin guard: accepts either:
 * 1. Header `x-admin-token: <ADMIN_TOKEN>` (env ADMIN_TOKEN)
 * 2. Header `x-telegram-init-data` with telegram_id matching env.ADMIN_TELEGRAM_ID (optional)
 */
export function adminRequired(req: AdminRequest, res: Response, next: NextFunction) {
  const headerToken = req.header('x-admin-token');
  if (headerToken && env.ADMIN_TOKEN && headerToken === env.ADMIN_TOKEN) {
    return next();
  }

  const initData = req.header('x-telegram-init-data');
  if (initData && env.ADMIN_TELEGRAM_ID) {
    try {
      const parsed = validateTelegramWebAppData(initData, env.BOT_TOKEN);
      if (parsed.user && parsed.user.id === env.ADMIN_TELEGRAM_ID) {
        return next();
      }
    } catch {
      /* fall through to 401 */
    }
  }

  return res.status(401).json({ error: 'admin access required' });
}
