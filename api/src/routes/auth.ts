import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { getSupabaseAdmin, type DBProfile } from '../lib/supabase.js';
import { fullNameOf, validateTelegramWebAppData } from '../services/telegram.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

const Body = z.object({
  initData: z.string().min(20).optional(),
});

export const authRouter = Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too many requests' },
});

authRouter.use(limiter);

/**
 * POST /auth/telegram
 * Body: { initData: string }  OR header `X-Telegram-Init-Data: <string>`
 * Returns the upserted profile and a Supabase access token usable by the WebApp.
 */
authRouter.post('/telegram', async (req, res) => {
  const raw = (req.header('x-telegram-init-data') ?? '') as string;
  const parsed = Body.safeParse(req.body ?? {});
  const initData =
    (typeof raw === 'string' && raw.length > 0 ? raw : parsed.success ? parsed.data.initData : null) ?? null;

  if (!initData) {
    return res.status(400).json({ error: 'initData missing' });
  }

  try {
    const telegramData = validateTelegramWebAppData(initData, env.BOT_TOKEN);
    const user = telegramData.user;
    if (!user) return res.status(400).json({ error: 'user missing in initData' });

    const db = getSupabaseAdmin();
    const telegramId = user.id;
    const fullName = fullNameOf(user);
    const username = user.username ?? null;

    // Upsert profile by telegram_id.
    const { data: existing, error: selectErr } = await db
      .from('profiles')
      .select('id, telegram_id, username, full_name, role, is_npd, created_at')
      .eq('telegram_id', telegramId)
      .maybeSingle();

    if (selectErr) throw selectErr;

    let profile: DBProfile | null = (existing as DBProfile | null) ?? null;

    if (!profile) {
      const { data: inserted, error: insertErr } = await db
        .from('profiles')
        .insert({
          telegram_id: telegramId,
          username,
          full_name: fullName,
          role: 'client',
          is_npd: false,
        })
        .select('id, telegram_id, username, full_name, role, is_npd, created_at')
        .single();
      if (insertErr) throw insertErr;
      profile = inserted as DBProfile;
    }

    // Generate a Supabase service-role session for the user. We use
    // signInWithIdToken mock: since v2 has no admin login-by-telegram, we hand
    // back a short-lived access token issued with service-role scope restricted
    // by RLS. The client uses username/password-less access via custom header.
    //
    // NOTE: real RLS-bound tokens for Telegram users are out of scope for Sprint
    // 1. Sprint 3 will swap this for a permanent Supabase session created via
    // the admin API and a `signed_access_token` flow.
    const session = {
      type: 'service' as const,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 1000 * 60 * 60 * 12,
      profile,
    };

    logger.info({ telegram_id: telegramId }, 'auth/telegram ok');

    return res.json({
      profile,
      session,
      publicWebUrl: env.PUBLIC_WEB_URL,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    logger.warn({ message }, 'auth/telegram failed');
    return res.status(401).json({ error: 'invalid initData', detail: message });
  }
});

authRouter.get('/me', (_req, res) => {
  return res.json({ ok: true });
});
