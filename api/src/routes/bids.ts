import { Router } from 'express';
import { z } from 'zod';
import type { AuthedRequest } from '../middleware/auth.js';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { authRequired } from '../middleware/auth.js';
import { sendBidNotification, sendMasterAcceptedNotification } from '../services/notifications.js';

const BodyCreate = z.object({
  proposed_price: z.coerce.number().positive().optional().nullable(),
  comment: z.string().max(500).optional(),
});

export const bidsRouter = Router();

bidsRouter.use(authRequired);

bidsRouter.post('/:orderId/bids', async (req: AuthedRequest, res) => {
  const parsed = BodyCreate.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid body', detail: parsed.error.flatten() });
  }

  const orderId = req.params.orderId;
  const telegramId = req.telegram!.user.id;

  try {
    const db = getSupabaseAdmin();

    const { data: profile, error: profileErr } = await db
      .from('profiles')
      .select('id, is_master, master_status')
      .eq('telegram_id', telegramId)
      .single();

    if (profileErr || !profile) {
      return res.status(404).json({ error: 'profile not found' });
    }

    if (!profile.is_master || profile.master_status !== 'approved') {
      return res.status(403).json({ error: 'only approved masters can bid' });
    }

    const { error: deductErr } = await db.rpc('deduct_response', { p_master_id: profile.id });
    if (deductErr) {
      logger.warn({ masterId: profile.id, err: deductErr.message }, 'deduct_response rpc issue');
    }

    const { data: bid, error: insertErr } = await db
      .from('bids')
      .insert({
        order_id: orderId,
        master_id: profile.id,
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
      db.from('profiles').select('full_name, username, avg_rating').eq('id', profile.id).single(),
      db.from('orders').select('category, description, client_id').eq('id', orderId).single(),
    ]);

    if (order && masterProfile) {
      const { data: clientProfile } = await db
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

    logger.info({ orderId, masterId: profile.id }, 'bid created');
    return res.status(201).json(bid);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ msg }, 'bid creation failed');
    return res.status(500).json({ error: 'bid failed', detail: msg });
  }
});

bidsRouter.get('/:orderId/bids', async (req: AuthedRequest, res) => {
  const orderId = req.params.orderId;
  const telegramId = req.telegram!.user.id;

  try {
    const db = getSupabaseAdmin();

    const { data: order, error: orderErr } = await db
      .from('orders')
      .select('client_id')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      return res.status(404).json({ error: 'order not found' });
    }

    const { data: clientProfile, error: cpErr } = await db
      .from('profiles')
      .select('id')
      .eq('telegram_id', telegramId)
      .single();

    if (cpErr || !clientProfile || clientProfile.id !== (order as { client_id: string }).client_id) {
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

bidsRouter.post('/:orderId/accept-bid/:bidId', async (req: AuthedRequest, res) => {
  const { orderId, bidId } = req.params;
  const telegramId = req.telegram!.user.id;

  try {
    const db = getSupabaseAdmin();

    const { data: order, error: orderErr } = await db
      .from('orders')
      .select('client_id, status, category')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) return res.status(404).json({ error: 'order not found' });

    const { data: clientProfile } = await db
      .from('profiles')
      .select('id')
      .eq('telegram_id', telegramId)
      .single();

    if (!clientProfile || clientProfile.id !== (order as { client_id: string }).client_id) {
      return res.status(403).json({ error: 'forbidden' });
    }

    if ((order as { status: string }).status !== 'open') {
      return res.status(400).json({ error: 'order is not open' });
    }

    const { data: updatedOrder, error: updateErr } = await db
      .from('orders')
      .update({ status: 'in_progress' })
      .eq('id', orderId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    const { data: bid, error: bidErr } = await db
      .from('bids')
      .select('master_id, proposed_price')
      .eq('id', bidId)
      .single();

    if (bidErr || !bid) return res.status(404).json({ error: 'bid not found' });

    const { data: masterProfile } = await db
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
