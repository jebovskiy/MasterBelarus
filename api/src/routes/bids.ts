import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { getUserClient, getSupabaseAdmin } from '../lib/user-client.js';
import { logger } from '../lib/logger.js';
import { jwtRequired, type JwtRequest } from '../middleware/jwt.js';
import { sendBidNotification, sendMasterAcceptedNotification } from '../services/notifications.js';

const bidLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String((req as JwtRequest).jwtPayload?.telegram_id ?? req.ip),
  message: { error: 'too many bids, try later' },
});

const BodyCreate = z.object({
  proposed_price: z.coerce.number().positive().optional().nullable(),
  comment: z.string().max(500).optional(),
});

export const bidsRouter = Router();

bidsRouter.use(jwtRequired);
bidsRouter.post('/:orderId/bids', bidLimiter);

bidsRouter.post('/:orderId/bids', async (req: JwtRequest, res) => {
  const parsed = BodyCreate.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid body', detail: parsed.error.flatten() });
  }

  const orderId = req.params.orderId;
  const profileId = req.jwtPayload!.profile_id;

  try {
    const dbAdmin = getSupabaseAdmin();
    const db = getUserClient(req.jwtToken!);

    const { data: profile, error: profileErr } = await db
      .from('profiles')
      .select('id, is_master, master_status')
      .eq('id', profileId)
      .single();

    if (profileErr || !profile) {
      return res.status(404).json({ error: 'profile not found' });
    }

    if (!profile.is_master) {
      return res.status(403).json({ error: 'only masters can bid' });
    }
    if (profile.master_status === 'blocked') {
      return res.status(403).json({ error: 'Ваш аккаунт заблокирован' });
    }

    const { data: deductOk, error: deductErr } = await dbAdmin.rpc('deduct_response', { p_master_id: profileId });
    if (deductErr || deductOk === false) {
      logger.warn({ masterId: profileId, err: deductErr?.message, result: deductOk }, 'deduct_response failed');
      return res.status(402).json({ error: 'Недостаточно откликов. Пополните баланс.' });
    }

    const { data: bid, error: insertErr } = await db
      .from('bids')
      .insert({
        order_id: orderId,
        master_id: profileId,
        proposed_price: parsed.data.proposed_price ?? null,
        comment: parsed.data.comment ?? null,
      })
      .select()
      .single();

    if (insertErr) {
      const code = (insertErr as { code?: string }).code;
      if (code === '23505') {
        return res.status(409).json({ error: 'you already bid on this order' });
      }
      throw insertErr;
    }

    const [{ data: masterProfile }, { data: order }] = await Promise.all([
      db.from('profiles').select('full_name, username, avg_rating').eq('id', profileId).single(),
      db.from('orders').select('category, description, client_id').eq('id', orderId).single(),
    ]);

    if (order && masterProfile) {
      const { data: clientProfile } = await dbAdmin
        .from('profiles')
        .select('telegram_id')
        .eq('id', (order as { client_id: string }).client_id)
        .maybeSingle();

      if (clientProfile) {
        const clientTgId = (clientProfile as { telegram_id: number }).telegram_id;
        const masterName =
          (masterProfile as { full_name: string | null }).full_name ??
          (masterProfile as { username: string | null }).username ??
          'Мастер';

        const mp = masterProfile as { avg_rating: number | null };

        void sendBidNotification({
          telegramId: clientTgId,
          masterName,
          rating: mp.avg_rating ?? undefined,
          price: parsed.data.proposed_price ?? undefined,
          orderId: orderId as string,
        }).catch((notifyErr) => {
          logger.warn({ notifyErr }, 'client notification failed');
        });
      }
    }

    logger.info({ orderId, masterId: profileId }, 'bid created');
    return res.status(201).json(bid);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ msg }, 'bid creation failed');
    return res.status(500).json({ error: 'bid failed', detail: msg });
  }
});

bidsRouter.get('/:orderId/bids', async (req: JwtRequest, res) => {
  const orderId = req.params.orderId;
  const profileId = req.jwtPayload!.profile_id;

  try {
    const db = getUserClient(req.jwtToken!);

    const { data: order, error: orderErr } = await db
      .from('orders')
      .select('client_id')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      return res.status(404).json({ error: 'order not found' });
    }

    if (profileId !== (order as { client_id: string }).client_id) {
      return res.status(403).json({ error: 'forbidden' });
    }

    const { data: bids, error: bidsErr } = await db
      .from('bids')
      .select('id, master_id, proposed_price, comment, created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (bidsErr) throw bidsErr;

    return res.json(bids ?? []);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return res.status(500).json({ error: msg });
  }
});

bidsRouter.post('/:orderId/accept-bid/:bidId', async (req: JwtRequest, res) => {
  const { orderId, bidId } = req.params;
  const profileId = req.jwtPayload!.profile_id;

  try {
    const db = getUserClient(req.jwtToken!);

    const { data: order, error: orderErr } = await db
      .from('orders')
      .select('client_id, status, category')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) return res.status(404).json({ error: 'order not found' });

    if (profileId !== (order as { client_id: string }).client_id) {
      return res.status(403).json({ error: 'forbidden' });
    }

    if ((order as { status: string }).status !== 'open') {
      return res.status(400).json({ error: 'order is not open' });
    }

    const { data: updatedOrder, error: updateErr } = await db
      .from('orders')
      .update({ status: 'in_progress' })
      .eq('id', orderId)
      .eq('status', 'open')
      .select()
      .single();

    if (updateErr || !updatedOrder) {
      return res.status(409).json({ error: 'Заказ уже принят другим мастером' });
    }

    const { data: bid, error: bidErr } = await db
      .from('bids')
      .select('master_id, proposed_price')
      .eq('id', bidId)
      .single();

    if (bidErr || !bid) return res.status(404).json({ error: 'bid not found' });

    const dbAdmin = getSupabaseAdmin();

    const { data: masterProfile } = await dbAdmin
      .from('profiles')
      .select('telegram_id')
      .eq('id', (bid as { master_id: string }).master_id)
      .single();

    if (masterProfile) {
      void sendMasterAcceptedNotification(
        (masterProfile as { telegram_id: number }).telegram_id,
        (order as { category: string }).category,
        (bid as { proposed_price: number | null }).proposed_price,
      ).catch((notifyErr) => {
        logger.warn({ notifyErr }, 'master notification failed');
      });
    }

    logger.info({ orderId, bidId }, 'bid accepted');
    return res.json(updatedOrder);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return res.status(500).json({ error: msg });
  }
});
