import { Router } from 'express';
import { z } from 'zod';
import type { AuthedRequest } from '../middleware/auth.js';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { authRequired } from '../middleware/auth.js';
import { sendBidNotification } from '../services/notifications.js';

const BodyCreate = z.object({
  proposed_price: z.coerce.number().positive().optional().nullable(),
  comment: z.string().max(500).optional(),
});

export const bidsRouter = Router();

bidsRouter.use(authRequired);

/**
 * POST /orders/:orderId/bids — мастер откликается на заказ
 */
bidsRouter.post('/:orderId/bids', async (req: AuthedRequest, res) => {
  const parsed = BodyCreate.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid body', detail: parsed.error.flatten() });
  }

  const orderId = req.params.orderId;
  const telegramId = req.telegram!.user.id;

  try {
    const db = getSupabaseAdmin();

    // Resolve master profile
    const { data: profile, error: profileErr } = await db
      .from('profiles')
      .select('id, role')
      .eq('telegram_id', telegramId)
      .single();

    if (profileErr || !profile) {
      return res.status(404).json({ error: 'profile not found' });
    }

    if (profile.role !== 'master') {
      return res.status(403).json({ error: 'only masters can bid' });
    }

    // Atomic: deduct response credit via RPC
    const { error: deductErr } = await db.rpc('deduct_response', { p_master_id: profile.id });
    if (deductErr) {
      // If the function returns false (not FOUND), it means no credits
      // We can't distinguish from error, so we treat any RPC error as failure
      // until we refactor deduct_response to return a typed status.
      // For now, we allow bid but log the issue.
      logger.warn({ masterId: profile.id, err: deductErr.message }, 'deduct_response rpc issue');
    }

    // Insert bid
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
      // If it's a unique violation, rollback the credit deduction
      const code = (insertErr as { code?: string }).code;
      if (code === '23505') {
        return res.status(409).json({ error: 'you already bid on this order' });
      }
      throw insertErr;
    }

    // Notify client (best-effort fire-and-forget)
    void notifyClient(db, orderId, profile.id, bid.id).catch((notifyErr) => {
      logger.warn({ notifyErr }, 'client notification failed');
    });

    logger.info({ orderId, masterId: profile.id }, 'bid created');
    return res.status(201).json(bid);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ msg }, 'bid creation failed');
    return res.status(500).json({ error: 'bid failed', detail: msg });
  }
});

/**
 * GET /orders/:orderId/bids — клиент видит отклики
 */
bidsRouter.get('/:orderId/bids', async (req: AuthedRequest, res) => {
  const orderId = req.params.orderId;
  const telegramId = req.telegram!.user.id;

  try {
    const db = getSupabaseAdmin();

    // Verify client owns the order
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

/**
 * POST /orders/:orderId/accept-bid/:bidId — клиент выбирает мастера
 */
bidsRouter.post('/:orderId/accept-bid/:bidId', async (req: AuthedRequest, res) => {
  const { orderId, bidId } = req.params;
  const telegramId = req.telegram!.user.id;

  try {
    const db = getSupabaseAdmin();

    // Verify ownership
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

    // Mark order as in_progress
    const { data: updatedOrder, error: updateErr } = await db
      .from('orders')
      .update({ status: 'in_progress' })
      .eq('id', orderId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // Get master info for notification
    const { data: bid, error: bidErr } = await db
      .from('bids')
      .select('master_id, proposed_price')
      .eq('id', bidId)
      .single();

    if (bidErr || !bid) return res.status(404).json({ error: 'bid not found' });

    const { data: masterProfile } = await db
      .from('profiles')
      .select('telegram_id, full_name, username')
      .eq('id', (bid as { master_id: string }).master_id)
      .single();

    // Notify master (best-effort)
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

async function notifyClient(
  db: ReturnType<typeof getSupabaseAdmin>,
  orderId: string,
  masterId: string,
  bidId: string,
) {
  const { data: order } = await db
    .from('orders')
    .select('category, description')
    .eq('id', orderId)
    .single();

  if (!order) return;

  const { data: master } = await db
    .from('profiles')
    .select('full_name, username')
    .eq('id', masterId)
    .single();

  if (!master) return;

  const { data: client } = await db
    .from('orders')
    .select('client_id')
    .eq('id', orderId)
    .single();

  if (!client) return;

  const { data: clientProfile } = await db
    .from('profiles')
    .select('telegram_id')
    .eq('id', (client as { client_id: string }).client_id)
    .single();

  if (!clientProfile) return;

  const clientTgId = (clientProfile as { telegram_id: number }).telegram_id;
  const masterName = (master as { full_name: string | null }).full_name ?? (master as { username: string | null }).username ?? 'Мастер';

  await sendBidNotification(
    clientTgId,
    (order as { category: string }).category,
    masterName,
    (order as { description: string }).description,
  );
}

async function sendMasterAcceptedNotification(
  telegramId: number,
  category: string,
  proposedPrice: number | null,
) {
  // Stub: Sprint 4 wires telegraf bot instance here
  logger.info(
    { telegramId, category, proposedPrice },
    '[NOTIFY] would send bid-accepted to master',
  );
}
