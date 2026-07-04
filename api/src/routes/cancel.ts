import { Router } from 'express';
import { z } from 'zod';
import type { AuthedRequest } from '../middleware/auth.js';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { authRequired } from '../middleware/auth.js';
import { checkCancelRate } from '../services/cancelTracker.js';
import { sendOrderCancelledToMasters, sendMasterCancelledToClient, sendRefundNotification } from '../services/notifications.js';
import { CLIENT_REASONS, MASTER_REASONS } from '../types/cancel.js';

const REFUND_WINDOW_MS = 5 * 60 * 1000;

const BodyCancel = z.object({
  cancelled_by: z.enum(['client', 'master']),
  cancellation_reason_id: z.number().int(),
  cancellation_reason_text: z.string().max(500).optional(),
});

export const cancelRouter = Router();

cancelRouter.use(authRequired);

cancelRouter.post('/:id/cancel', async (req: AuthedRequest, res) => {
  const parsed = BodyCancel.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid body', detail: parsed.error.flatten() });
  }

  const { cancelled_by, cancellation_reason_id, cancellation_reason_text } = parsed.data;
  const orderId = req.params.id ?? '';
  const telegramId = req.telegram!.user.id;

  try {
    const db = getSupabaseAdmin();

    const { data: profile } = await db
      .from('profiles')
      .select('id')
      .eq('telegram_id', telegramId)
      .single();

    if (!profile) return res.status(404).json({ error: 'profile not found' });

    const { data: order, error: orderErr } = await db
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) return res.status(404).json({ error: 'order not found' });

    const o = order as {
      client_id: string;
      status: string;
      category: string;
      created_at: string;
    };

    if (o.status === 'cancelled') return res.status(400).json({ error: 'already cancelled' });

    if (cancelled_by === 'client') {
      if (profile.id !== o.client_id) return res.status(403).json({ error: 'not your order' });
      if (o.status !== 'open') return res.status(400).json({ error: 'can only cancel open orders' });

      const validIds: number[] = CLIENT_REASONS.map(r => r.id);
      if (!validIds.includes(cancellation_reason_id)) {
        return res.status(400).json({ error: 'invalid reason' });
      }

      const reasonObj = CLIENT_REASONS.find(r => r.id === cancellation_reason_id);
      const reasonLabel = reasonObj?.label ?? 'Другое';

      const rate = checkCancelRate(telegramId);
      if (!rate.allowed) {
        await db.from('profiles').update({ suspicious: true }).eq('telegram_id', telegramId);
        await db.from('complaints').insert({
          user_name: `user_${telegramId}`,
          user_role: 'client',
          text: `Автоматический тикет: превышение лимита отмен (${rate.count} за 24ч).`,
        });
      }

      const isEarlyCancel =
        cancellation_reason_id === 1 ||
        (Date.now() - new Date(o.created_at).getTime()) < REFUND_WINDOW_MS;

      if (isEarlyCancel) {
        const { data: bids } = await db
          .from('bids')
          .select('master_id')
          .eq('order_id', orderId);

        if (bids?.length) {
          const masterIds = (bids as { master_id: string }[]).map((b) => b.master_id);

          const { data: masters } = await db
            .from('profiles')
            .select('id, telegram_id, full_name, username')
            .in('id', masterIds);

          const { data: balances } = await db
            .from('master_balances')
            .select('master_id, response_credits')
            .in('master_id', masterIds);

          const balMap = new Map((balances ?? []).map((b: any) => [b.master_id, b.response_credits]));
          const profMap = new Map((masters ?? []).map((m: any) => [m.id, m]));

          await Promise.allSettled(
            (bids as { master_id: string }[]).map(async (bid) => {
              const cur = (balMap.get(bid.master_id) as number | undefined) ?? 0;
              await db.from('master_balances').upsert(
                { master_id: bid.master_id, response_credits: cur + 1 },
                { onConflict: 'master_id' },
              );

              const mp = profMap.get(bid.master_id) as { telegram_id: number; full_name: string | null; username: string | null } | undefined;
              if (mp) {
                void sendRefundNotification(mp.telegram_id, mp.full_name ?? mp.username ?? 'Мастер', orderId);
              }
            })
          );
        }
      }
    }

    if (cancelled_by === 'master') {
      const { data: bid } = await db
        .from('bids')
        .select('master_id')
        .eq('order_id', orderId)
        .eq('master_id', profile.id)
        .maybeSingle();

      if (!bid) return res.status(403).json({ error: 'you are not assigned to this order' });

      if (o.status !== 'in_progress') return res.status(400).json({ error: 'order is not in progress' });

      const validIds: number[] = MASTER_REASONS.map(r => r.id);
      if (!validIds.includes(cancellation_reason_id)) {
        return res.status(400).json({ error: 'invalid reason' });
      }

      const reasonObj = MASTER_REASONS.find(r => r.id === cancellation_reason_id);
      const reasonLabel = reasonObj?.label ?? 'Другое';

      const { data: clientProfile } = await db
        .from('profiles')
        .select('telegram_id')
        .eq('id', o.client_id)
        .single() as unknown as { data: { telegram_id: number } | null };

      if (clientProfile) {
        void sendMasterCancelledToClient(clientProfile.telegram_id, orderId, reasonLabel);
      }
    }

    const { error: statusErr } = await db
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', orderId);
    if (statusErr) throw statusErr;

    // try to persist cancellation details (columns may not exist yet — ignore if so)
    const { error: detailErr } = await db
      .from('orders')
      .update({
        cancelled_by,
        cancellation_reason_id,
        cancellation_reason_text: cancellation_reason_text ?? null,
      })
      .eq('id', orderId);
    if (detailErr) {
      logger.warn({ orderId, detail: detailErr.message }, 'cancel detail save skipped (migration 014?)');
    }

    logger.info({ orderId, cancelled_by, cancellation_reason_id }, 'order cancelled');
    return res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ orderId, msg }, 'cancel failed');
    return res.status(500).json({ error: 'cancel failed', detail: msg });
  }
});

/**
 * POST /orders/:id/reactivate — вернуть отменённый заказ в статус open
 * Только клиент, только если статус cancelled и cancelled_by === 'master'
 */
cancelRouter.post('/:id/reactivate', async (req: AuthedRequest, res) => {
  const orderId = req.params.id ?? '';
  const telegramId = req.telegram!.user.id;

  try {
    const db = getSupabaseAdmin();

    const { data: profile } = await db
      .from('profiles')
      .select('id')
      .eq('telegram_id', telegramId)
      .single();

    if (!profile) return res.status(404).json({ error: 'profile not found' });

    const { data: order, error: orderErr } = await db
      .from('orders')
      .select('id, client_id, status, cancelled_by')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) return res.status(404).json({ error: 'order not found' });

    const o = order as { client_id: string; status: string; cancelled_by: string };

    if (profile.id !== o.client_id) return res.status(403).json({ error: 'not your order' });
    if (o.status !== 'cancelled') return res.status(400).json({ error: 'order is not cancelled' });
    if (o.cancelled_by !== 'master') return res.status(400).json({ error: 'can only reactivate after master cancellation' });

    const { error: updateErr } = await db
      .from('orders')
      .update({ status: 'open' })
      .eq('id', orderId);

    if (updateErr) throw updateErr;

    logger.info({ orderId }, 'order reactivated');
    return res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ orderId, msg }, 'reactivate failed');
    return res.status(500).json({ error: 'reactivate failed', detail: msg });
  }
});
