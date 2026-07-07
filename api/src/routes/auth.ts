import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { fileTypeFromBuffer } from 'file-type';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { z } from 'zod';
import { getSupabaseAdmin, type DBProfile } from '../lib/user-client.js';
import { fullNameOf, validateTelegramWebAppData } from '../services/telegram.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { jwtRequired, type JwtRequest } from '../middleware/jwt.js';
import { captureEvent, identifyUser } from '../lib/analytics.js';
import { isValidCity } from '../data/belarus-cities.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

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
      .select('id, telegram_id, username, full_name, role, is_npd, avatar_url, is_master, current_role, master_status, phone, description, city, radius_km, avg_rating, review_count, created_at')
      .eq('telegram_id', telegramId)
      .maybeSingle();

    if (selectErr) throw selectErr;

    let profile: DBProfile | null = (existing as DBProfile | null) ?? null;
    const photoUrl = user.photo_url ?? null;

    if (!profile) {
      const { data: inserted, error: insertErr } = await db
        .from('profiles')
        .insert({
          telegram_id: telegramId,
          username,
          full_name: fullName,
          role: 'client',
          is_npd: false,
          avatar_url: photoUrl,
        })
        .select('id, telegram_id, username, full_name, role, is_npd, avatar_url, is_master, current_role, master_status, phone, description, city, radius_km, avg_rating, review_count, created_at')
        .single();
      if (insertErr) throw insertErr;
      profile = inserted as DBProfile;
    } else if (photoUrl && photoUrl !== profile.avatar_url) {
      await db.from('profiles').update({ avatar_url: photoUrl }).eq('id', profile.id);
      profile.avatar_url = photoUrl;
    }

    // Fetch master categories
    const { data: cats } = await db.from('master_categories').select('category').eq('master_id', profile.id);
    const categories: string[] = (cats ?? []).map((r: { category: string }) => r.category);

    // Fetch balance
    const { data: balanceRow } = await db.from('master_balances').select('response_credits').eq('master_id', profile.id).maybeSingle();
    const responseCredits = balanceRow ? (balanceRow as { response_credits: number }).response_credits : 0;

    // Create/link Supabase Auth user
    let authUserId = profile.auth_user_id;
    if (!authUserId) {
      const email = `tg_${telegramId}@mb.internal`;
      const password = randomBytes(24).toString('hex');
      const { data: authUser, error: createErr } = await db.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { telegram_id: telegramId },
      });
      if (createErr) {
        logger.warn({ msg: createErr.message }, 'auth user creation failed');
      }
      if (authUser?.user?.id) {
        authUserId = authUser.user.id;
        await db.from('profiles').update({ auth_user_id: authUserId }).eq('id', profile.id);
        profile.auth_user_id = authUserId;
      }
    }

    // Sign JWT
    const jwtToken = jwt.sign(
      { sub: authUserId ?? profile.id, profile_id: profile.id, telegram_id: telegramId },
      env.JWT_SECRET,
      { expiresIn: '7d' },
    );

    identifyUser(`tg_${telegramId}`, {
      role: profile.role,
      is_master: profile.is_master,
      is_npd: profile.is_npd,
    });
    captureEvent(`tg_${telegramId}`, 'user_login', {
      is_new: !existing,
      role: profile.role,
    });

    logger.info({ telegram_id: telegramId }, 'auth/telegram ok');

    return res.json({
      profile: { ...profile, categories, response_credits: responseCredits },
      jwt: jwtToken,
      publicWebUrl: env.PUBLIC_WEB_URL,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    logger.warn({ message }, 'auth/telegram failed');
    return res.status(401).json({ error: 'invalid initData', detail: message });
  }
});

/**
 * POST /auth/avatar — загрузить аватарку
 */
authRouter.post('/avatar', jwtRequired, upload.single('avatar'), async (req: JwtRequest, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'file missing' });
  if (!file.mimetype.startsWith('image/')) {
    return res.status(400).json({ error: 'only images allowed' });
  }
  const type = await fileTypeFromBuffer(file.buffer);
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!type || !allowedTypes.includes(type.mime)) {
    return res.status(400).json({ error: 'invalid image format — only JPEG, PNG, WebP allowed' });
  }

  try {
    const profileId = req.jwtPayload!.profile_id;
    const dbAdmin = getSupabaseAdmin();

    const extMap: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
    const ext = extMap[file.mimetype] ?? 'jpg';
    const timestamp = Date.now();
    const filePath = `u_${profileId}_${timestamp}.${ext}`;

    const { error: uploadErr } = await dbAdmin.storage.from('avatars').upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });
    if (uploadErr) throw uploadErr;

    const { data: publicUrl } = dbAdmin.storage.from('avatars').getPublicUrl(filePath);

    const { error: updateErr } = await dbAdmin
      .from('profiles')
      .update({ avatar_url: publicUrl.publicUrl })
      .eq('id', profileId);
    if (updateErr) throw updateErr;

    return res.json({ avatar_url: publicUrl.publicUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ msg }, 'auth/avatar upload failed');
    return res.status(500).json({ error: 'upload failed', detail: msg });
  }
});

/**
 * POST /auth/become-master — подать заявку на статус мастера
 */
authRouter.post('/become-master', jwtRequired, async (req: JwtRequest, res) => {
  const Schema = z.object({
    full_name: z.string().min(1).max(200),
    phone: z.string().min(5).max(20),
    city: z.string().min(1).max(100).refine((c) => isValidCity(c), { message: 'неподдерживаемый город' }),
    category: z.string().min(1).max(50),
  });
  const parsed = Schema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'invalid body', detail: parsed.error.flatten() });

  try {
    const profileId = req.jwtPayload!.profile_id;
    const telegramId = req.jwtPayload!.telegram_id;
    const dbAdmin = getSupabaseAdmin();
    const db = getSupabaseAdmin();

    const { data: existing } = await db
      .from('profiles')
      .select('id, master_status')
      .eq('id', profileId)
      .maybeSingle();
    if (!existing) return res.status(404).json({ error: 'profile not found' });
    if (existing.master_status === 'pending') return res.status(400).json({ error: 'already pending' });
    if (existing.master_status === 'approved') return res.status(400).json({ error: 'already a master' });

    const { error: updateErr } = await db
      .from('profiles')
      .update({
        full_name: parsed.data.full_name,
        phone: parsed.data.phone,
        city: parsed.data.city,
        category: parsed.data.category,
        master_status: 'pending',
      })
      .eq('id', profileId);
    if (updateErr) throw updateErr;

    await getSupabaseAdmin().from('master_categories').insert(
      { master_id: profileId, category: parsed.data.category },
    ).then(() => {});

    // Notify moderator chat
    const { getBot } = await import('../services/botRegistry.js');
    const bot = getBot();
    const chatId = env.MODERATOR_CHAT_ID;
    if (chatId) {
      const { data: profile } = await dbAdmin
        .from('profiles')
        .select('username, full_name')
        .eq('id', profileId)
        .single();

      const uname = (profile as { username: string | null; full_name: string | null } | null)?.username ?? '—';
      await bot.telegram.sendMessage(chatId, [
        `👤 Новая заявка на статус мастера`,
        `Имя: ${parsed.data.full_name}`,
        `Телефон: ${parsed.data.phone}`,
        `Город: ${parsed.data.city}`,
        `Специализация: ${parsed.data.category}`,
        `Telegram ID: ${telegramId}`,
        `Username: @${uname}`,
      ].join('\n'), {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Принять', callback_data: `approve_master:${telegramId}` },
              { text: '❌ Отклонить', callback_data: `reject_master:${telegramId}` },
            ],
          ],
        },
      });
    }

    logger.info({ telegram_id: telegramId }, 'auth/become-master submitted');
    return res.json({ master_status: 'pending' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ msg }, 'auth/become-master failed');
    return res.status(500).json({ error: 'request failed', detail: msg });
  }
});

/**
 * POST /auth/switch-role — переключить current_role (только если is_master)
 */
authRouter.post('/switch-role', jwtRequired, async (req: JwtRequest, res) => {
  try {
    const profileId = req.jwtPayload!.profile_id;
    const db = getSupabaseAdmin();

    const { data: existing } = await db
      .from('profiles')
      .select('id, is_master, current_role')
      .eq('id', profileId)
      .maybeSingle();
    if (!existing) return res.status(404).json({ error: 'profile not found' });
    if (!existing.is_master) return res.status(403).json({ error: 'not a master' });

    const newRole = existing.current_role === 'customer' ? 'master' : 'customer';
    const { error: updateErr } = await db
      .from('profiles')
      .update({ current_role: newRole })
      .eq('id', profileId);
    if (updateErr) throw updateErr;

    return res.json({ current_role: newRole });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ msg }, 'auth/switch-role failed');
    return res.status(500).json({ error: 'switch failed', detail: msg });
  }
});

/**
 * GET /auth/master-status — текущий статус мастера
 */
authRouter.get('/master-status', jwtRequired, async (req: JwtRequest, res) => {
  try {
    const profileId = req.jwtPayload!.profile_id;
    const db = getSupabaseAdmin();

    const { data } = await db
      .from('profiles')
      .select('is_master, current_role, master_status')
      .eq('id', profileId)
      .maybeSingle();
    if (!data) return res.status(404).json({ error: 'profile not found' });
    return res.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return res.status(500).json({ error: msg });
  }
});

const ProfileUpdate = z.object({
  full_name: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  city: z.string().max(100).refine((c) => !c || isValidCity(c), { message: 'неподдерживаемый город' }).optional(),
  description: z.string().max(2000).optional(),
  radius_km: z.coerce.number().int().min(1).max(200).optional(),
  categories: z.array(z.string().min(1).max(50)).optional(),
});

/**
 * PATCH /auth/profile — обновить профиль пользователя
 */
authRouter.patch('/profile', jwtRequired, async (req: JwtRequest, res) => {
  const parsed = ProfileUpdate.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid body', detail: parsed.error.flatten() });
  }

  try {
    const profileId = req.jwtPayload!.profile_id;
    const db = getSupabaseAdmin();

    const { categories, ...profileFields } = parsed.data;
    const updates: Record<string, unknown> = {};
    if (profileFields.full_name && profileFields.full_name.trim()) updates.full_name = profileFields.full_name.trim();
    if (profileFields.phone && profileFields.phone.trim()) updates.phone = profileFields.phone.trim();
    if (profileFields.city && profileFields.city.trim()) updates.city = profileFields.city.trim();
    if (profileFields.description && profileFields.description.trim()) updates.description = profileFields.description.trim();
    if (profileFields.radius_km !== undefined) updates.radius_km = profileFields.radius_km;

    if (Object.keys(updates).length > 0) {
      const { error: updateErr } = await db.from('profiles').update(updates).eq('id', profileId);
      if (updateErr) throw updateErr;
    }

    if (categories !== undefined) {
      const { error: catErr } = await db.rpc('update_master_categories', {
        p_master_id: profileId,
        p_categories: categories,
      });
      if (catErr) throw catErr;
    }

    const { data: updated } = await db.from('profiles').select('*').eq('id', profileId).single();
    return res.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ msg }, 'auth/profile patch failed');
    return res.status(500).json({ error: 'update failed', detail: msg });
  }
});

authRouter.get('/me', (_req, res) => {
  return res.json({ ok: true });
});
