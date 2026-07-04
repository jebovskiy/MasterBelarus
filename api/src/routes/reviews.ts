import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import type { AuthedRequest } from '../middleware/auth.js';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { authRequired } from '../middleware/auth.js';

const reviewLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String((req as AuthedRequest).telegram?.user?.id ?? req.ip),
  message: { error: 'too many reviews, try later' },
});

const BodyCreate = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(1000).optional().default(''),
});

export const reviewsRouter = Router();

reviewsRouter.use(authRequired);
reviewsRouter.post('/:orderId/review', reviewLimiter);

/**
 * POST /orders/:orderId/review — оставить отзыв о мастере
 * Доступен только клиенту, владеющему заказом, и только для заказов 'in_progress' или 'completed'.
 */
reviewsRouter.post('/:orderId/review', async (req: AuthedRequest, res) => {
  const parsed = BodyCreate.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid body', detail: parsed.error.flatten() });
  }

  const orderId = req.params.orderId;
  const telegramId = req.telegram!.user.id;

  try {
    const db = getSupabaseAdmin();

    // Verify client owns the order
    const { data: order, error: orderErr } = await db
      .from('orders')
      .select('client_id, master_id, status')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      return res.status(404).json({ error: 'order not found' });
    }

    const { data: clientProfile } = await db
      .from('profiles')
      .select('id, role')
      .eq('telegram_id', telegramId)
      .single();

    if (!clientProfile || clientProfile.id !== (order as { client_id: string }).client_id) {
      return res.status(403).json({ error: 'forbidden' });
    }

    const orderStatus = (order as { status: string }).status;
    if (!['in_progress', 'completed'].includes(orderStatus)) {
      return res.status(400).json({ error: 'order must be in_progress or completed to review' });
    }

    // Check if review already exists for this order
    const { data: existing } = await db
      .from('reviews')
      .select('id')
      .eq('order_id', orderId)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'review already exists for this order' });
    }

    const { data: review, error: reviewErr } = await db
      .from('reviews')
      .insert({
        order_id: orderId,
        client_id: (clientProfile as { id: string }).id,
        master_id: (order as { master_id: string }).master_id,
        rating: parsed.data.rating,
        comment: parsed.data.comment ?? '',
      })
      .select()
      .single();

    if (reviewErr) throw reviewErr;

    // Mark order as completed
    await db.from('orders').update({ status: 'completed' }).eq('id', orderId);

    logger.info({ orderId, rating: parsed.data.rating }, 'review created');
    return res.status(201).json(review);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ msg }, 'review creation failed');
    return res.status(500).json({ error: 'review failed', detail: msg });
  }
});
