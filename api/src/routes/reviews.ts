import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { getSupabaseAdmin } from '../lib/user-client.js';
import { logger } from '../lib/logger.js';
import { jwtRequired, type JwtRequest } from '../middleware/jwt.js';
import { telegramIdOrIp } from '../lib/express-helpers.js';

const reviewLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => telegramIdOrIp(req),
  message: { error: 'too many reviews, try later' },
});

const BodyCreate = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(1000).optional().default(''),
});

export const reviewsRouter = Router();

reviewsRouter.use(jwtRequired);
reviewsRouter.post('/:orderId/review', reviewLimiter);

/**
 * POST /orders/:orderId/review — оставить отзыв о мастере
 * Доступен только клиенту, владеющему заказом, и только для заказов 'in_progress' или 'completed'.
 */
reviewsRouter.post('/:orderId/review', async (req: JwtRequest, res) => {
  const parsed = BodyCreate.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid body', detail: parsed.error.flatten() });
  }

  const orderId = req.params.orderId;
  const profileId = req.jwtPayload!.profile_id;

  try {
    const db = getSupabaseAdmin();

    const { data: order, error: orderErr } = await db
      .from('orders')
      .select('client_id, status')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      return res.status(404).json({ error: 'order not found' });
    }

    if (profileId !== (order as { client_id: string }).client_id) {
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

    // Look up the accepted master from bids
    const { data: acceptedBid } = await db
      .from('bids')
      .select('master_id')
      .eq('order_id', orderId)
      .eq('status', 'accepted')
      .maybeSingle();

    if (!acceptedBid) {
      return res.status(400).json({ error: 'no accepted master found for this order' });
    }

    const { data: review, error: reviewErr } = await db
      .from('reviews')
      .insert({
        order_id: orderId,
        client_id: profileId,
        master_id: (acceptedBid as { master_id: string }).master_id,
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

/**
 * GET /orders/:orderId/review — получить отзыв и профиль мастера для заказа
 */
reviewsRouter.get('/:orderId/review', async (req: JwtRequest, res) => {
  const { orderId } = req.params;

  try {
    const db = getSupabaseAdmin();

    const { data: review, error: revErr } = await db
      .from('reviews')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();

    if (revErr) throw revErr;

    if (!review) return res.json(null);

    const r = review as { master_id: string; rating: number; comment: string | null; created_at: string };
    const { data: master } = await db
      .from('profiles')
      .select('id, full_name, phone, avg_rating, review_count')
      .eq('id', r.master_id)
      .single();

    return res.json({ ...r, master: master ?? null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return res.status(500).json({ error: msg });
  }
});
