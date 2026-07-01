import type { NextFunction, Request, Response } from 'express';
import {
  fullNameOf,
  validateTelegramWebAppData,
  type TelegramWebAppUser,
} from '../services/telegram.js';
import { env } from '../config/env.js';

export type AuthedRequest = Request & {
  telegram?: {
    user: TelegramWebAppUser;
    fullName: string | null;
    username: string | null;
    authDate: number;
    startParam?: string;
  };
};

/**
 * Middleware: requires `X-Telegram-Init-Data` header (or `initData` body) and
 * validates it against the bot token. On success, populates req.telegram.
 */
export function authRequired(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.header('x-telegram-init-data');
  const body =
    (req.body && typeof req.body === 'object' ? (req.body as { initData?: unknown }).initData : undefined) ?? null;
  const initData = (typeof header === 'string' && header.length > 0 ? header : body) as string | null;

  if (!initData) {
    return res.status(401).json({ error: 'missing initData' });
  }

  try {
    const parsed = validateTelegramWebAppData(initData, env.BOT_TOKEN);
    if (!parsed.user) {
      return res.status(401).json({ error: 'missing user in initData' });
    }
    req.telegram = {
      user: parsed.user,
      fullName: fullNameOf(parsed.user),
      username: parsed.user.username ?? null,
      authDate: parsed.auth_date,
      startParam: parsed.start_param,
    };
    return next();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    return res.status(401).json({ error: 'invalid initData', detail: message });
  }
}
