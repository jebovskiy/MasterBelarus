import { Router } from 'express';
import { z } from 'zod';
import { getUserClient } from '../lib/user-client.js';
import { logger } from '../lib/logger.js';
import { jwtRequired, type JwtRequest } from '../middleware/jwt.js';

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
    const db = getUserClient(req.jwtToken!);

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

    const { data: messages, error } = await db
      .from('messages')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return res.json(messages ?? []);
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
    const db = getUserClient(req.jwtToken!);

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
    return res.status(201).json(message);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ msg }, 'message send failed');
    return res.status(500).json({ error: msg });
  }
});
