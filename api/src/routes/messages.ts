import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseAdmin } from '../lib/user-client.js';
import { logger } from '../lib/logger.js';
import { jwtRequired, type JwtRequest } from '../middleware/jwt.js';
import { sendChatMessageNotification } from '../services/notifications.js';

const BodySend = z.object({
  text: z.string().min(1).max(2000),
});

export const messagesRouter = Router();

messagesRouter.use(jwtRequired);

/**
 * GET /orders/:orderId/messages — получить сообщения заказа
 */
messagesRouter.get('/:orderId/messages', async (req: JwtRequest, res) => {
  const { orderId } = req.params;
  const profileId = req.jwtPayload!.profile_id;

  try {
    const db = getSupabaseAdmin();

    const { data: order, error: orderErr } = await db
      .from('orders')
      .select('client_id')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) return res.status(404).json({ error: 'order not found' });

    const { data: myBid } = await db
      .from('bids')
      .select('id')
      .eq('order_id', orderId)
      .eq('master_id', profileId)
      .maybeSingle();

    const isParticipant = (order as { client_id: string }).client_id === profileId || !!myBid;
    if (!isParticipant) return res.status(403).json({ error: 'forbidden' });

    // Check if blocked
    const oGet = order as { client_id: string };
    const isClientGet = oGet.client_id === profileId;
    let otherIdBlock: string | null = null;
    if (isClientGet) {
      const { data: ab } = await db.from('bids').select('master_id').eq('order_id', orderId).eq('status', 'accepted').maybeSingle();
      otherIdBlock = (ab as { master_id: string } | null)?.master_id ?? null;
    } else {
      otherIdBlock = oGet.client_id;
    }
    if (otherIdBlock) {
      const { data: blockRow } = await db.from('blocked_users').select('id')
        .or(`and(blocker_id.eq.${profileId},blocked_id.eq.${otherIdBlock}),and(blocker_id.eq.${otherIdBlock},blocked_id.eq.${profileId})`)
        .maybeSingle();
      if (blockRow) return res.status(403).json({ error: 'user is blocked' });
    }

    const { data: messages, error } = await db
      .from('messages')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Fetch other participant's last_read_at for read receipts
    let otherReadAt: string | null = null;
    try {
      const isClient = (order as { client_id: string }).client_id === profileId;
      let otherId: string | null = null;

      if (isClient) {
        const { data: acceptedBid } = await db
          .from('bids')
          .select('master_id')
          .eq('order_id', orderId)
          .eq('status', 'accepted')
          .single();
        otherId = (acceptedBid as { master_id: string } | null)?.master_id ?? null;
      } else {
        otherId = (order as { client_id: string }).client_id;
      }

      if (otherId) {
        const { data: readState } = await getSupabaseAdmin()
          .from('chat_read_state')
          .select('last_read_at')
          .eq('order_id', orderId)
          .eq('profile_id', otherId)
          .maybeSingle();
        otherReadAt = (readState as { last_read_at: string } | null)?.last_read_at ?? null;
      }
    } catch {
      // non-critical: read receipts are best-effort
    }

    return res.json({ messages: messages ?? [], other_read_at: otherReadAt });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ msg }, 'messages get failed');
    return res.status(500).json({ error: msg });
  }
});

/**
 * POST /orders/:orderId/messages — отправить сообщение
 */
messagesRouter.post('/:orderId/messages', async (req: JwtRequest, res) => {
  const { orderId } = req.params;
  const profileId = req.jwtPayload!.profile_id;
  const parsed = BodySend.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid body', detail: parsed.error.flatten() });
  }

  try {
    const db = getSupabaseAdmin();

    const { data: order, error: orderErr } = await db
      .from('orders')
      .select('client_id')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) return res.status(404).json({ error: 'order not found' });

    const { data: myBid } = await db
      .from('bids')
      .select('id')
      .eq('order_id', orderId)
      .eq('master_id', profileId)
      .maybeSingle();

    const isParticipant = (order as { client_id: string }).client_id === profileId || !!myBid;
    if (!isParticipant) return res.status(403).json({ error: 'forbidden' });

    // Check if blocked
    const o = order as { client_id: string };
    const isSenderClient = o.client_id === profileId;
    let otherProfileId: string | null = null;
    if (isSenderClient) {
      const { data: acceptedBid } = await db.from('bids').select('master_id').eq('order_id', orderId).eq('status', 'accepted').maybeSingle();
      otherProfileId = (acceptedBid as { master_id: string } | null)?.master_id ?? null;
    } else {
      otherProfileId = o.client_id;
    }
    if (otherProfileId) {
      const { data: blockRow } = await db.from('blocked_users').select('id')
        .or(`and(blocker_id.eq.${profileId},blocked_id.eq.${otherProfileId}),and(blocker_id.eq.${otherProfileId},blocked_id.eq.${profileId})`)
        .maybeSingle();
      if (blockRow) return res.status(403).json({ error: 'user is blocked' });
    }

    const { data: message, error } = await db
      .from('messages')
      .insert({
        order_id: orderId,
        sender_id: profileId,
        text: parsed.data.text,
      })
      .select()
      .single();

    if (error) throw error;
    logger.info({ orderId, messageId: message.id }, 'message sent');

    // Send Telegram notification to the other participant (fire-and-forget)
    void (async () => {
      try {
        const o = order as { client_id: string };
        const isSenderClient = o.client_id === profileId;
        const dbAdmin = getSupabaseAdmin();

        // Get sender name
        const { data: senderProfile } = await dbAdmin
          .from('profiles')
          .select('full_name')
          .eq('id', profileId)
          .single();
        const senderName = (senderProfile as { full_name: string | null } | null)?.full_name ?? 'Пользователь';

        // Determine other participant's profile_id
        let otherProfileId: string | null = null;
        if (isSenderClient) {
          const { data: acceptedBid } = await dbAdmin
            .from('bids')
            .select('master_id')
            .eq('order_id', orderId)
            .eq('status', 'accepted')
            .single();
          otherProfileId = (acceptedBid as { master_id: string } | null)?.master_id ?? null;
        } else {
          otherProfileId = o.client_id;
        }

        if (otherProfileId) {
          const { data: otherProfile } = await dbAdmin
            .from('profiles')
            .select('telegram_id')
            .eq('id', otherProfileId)
            .single();

          if (otherProfile) {
            await sendChatMessageNotification(
              (otherProfile as { telegram_id: number }).telegram_id,
              senderName,
              parsed.data.text,
              orderId!,
            );
          }
        }
      } catch {
        // non-critical: notification failure should not block message sending
      }
    })();

    return res.status(201).json(message);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ msg }, 'message send failed');
    return res.status(500).json({ error: msg });
  }
});
