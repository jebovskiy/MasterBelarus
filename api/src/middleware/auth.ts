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

const hmacCache = new Map<string, { parsed: ReturnType<typeof validateTelegramWebAppData>; ts: number }>();
const HMAC_CACHE_TTL = 300_000; // 5 min
let cacheCleanupId: ReturnType<typeof setInterval> | null = null;

function initCacheCleanup() {
  if (cacheCleanupId) return;
  cacheCleanupId = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hmacCache) {
      if (now - v.ts > HMAC_CACHE_TTL) hmacCache.delete(k);
    }
  }, 60_000);
}

function getHashFromInitData(initData: string): string | null {
  try {
    return new URLSearchParams(initData).get('hash');
  } catch {
    return null;
  }
}

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

  const hash = getHashFromInitData(initData);
  if (hash && hmacCache.has(hash)) {
    const cached = hmacCache.get(hash)!;
    cached.parsed.user!.id;
    if (cached.ts > Date.now() - HMAC_CACHE_TTL) {
      initCacheCleanup();
      const p = cached.parsed;
      if (!p.user) {
        return res.status(401).json({ error: 'missing user in initData' });
      }
      req.telegram = {
        user: p.user,
        fullName: fullNameOf(p.user),
        username: p.user.username ?? null,
        authDate: p.auth_date,
        startParam: p.start_param,
      };
      return next();
    }
    hmacCache.delete(hash);
  }

  try {
    const parsed = validateTelegramWebAppData(initData, env.BOT_TOKEN);
    if (!parsed.user) {
      return res.status(401).json({ error: 'missing user in initData' });
    }
    if (hash && parsed.hash) {
      hmacCache.set(hash, { parsed, ts: Date.now() });
      initCacheCleanup();
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
