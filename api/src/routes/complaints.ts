import { Router } from 'express';
import { z } from 'zod';
import { authRequired, type AuthedRequest } from '../middleware/auth.js';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { notifyComplaintToModerator } from '../services/notifications.js';
import { logger } from '../lib/logger.js';

const BodyCreate = z.object({
  text: z.string().min(5, 'Слишком короткий текст жалобы'),
  user_role: z.enum(['customer', 'master']).default('customer'),
  accused_telegram_id: z.coerce.number().optional(),
});

export const complaintsRouter = Router();
complaintsRouter.use(authRequired);

/**
 * POST /complaints — подать жалобу
 */
complaintsRouter.post('/', async (req: AuthedRequest, res) => {
  const parsed = BodyCreate.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid body', detail: parsed.error.flatten() });
  }

  const { text, user_role, accused_telegram_id } = parsed.data;
  const tgUser = req.telegram?.user;

  try {
    const db = getSupabaseAdmin();

    const { data: profile } = await db
      .from('profiles')
      .select('id, full_name')
      .eq('telegram_id', tgUser!.id)
      .single();

    if (!profile) return res.status(404).json({ error: 'profile not found' });

    const { data: complaint, error } = await db
      .from('complaints')
      .insert({
        user_name: profile.full_name ?? `User#${tgUser!.id}`,
        user_role,
        text,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // Forward to admin chat in background
    notifyComplaintToModerator({
      id: complaint.id,
      userName: complaint.user_name,
      userRole: complaint.user_role,
      text: complaint.text,
      accusedTgId: accused_telegram_id,
    }).catch((err) => logger.warn({ err }, 'complaint notify failed'));

    return res.status(201).json(complaint);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ msg }, 'complaint create failed');
    return res.status(500).json({ error: 'create failed', detail: msg });
  }
});
