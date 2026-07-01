import { Router } from 'express';
import { z } from 'zod';
import type { AuthedRequest } from '../middleware/auth.js';
import { getSupabaseAdmin, type DBOrderStatus } from '../lib/supabase.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { authRequired } from '../middleware/auth.js';

const BodyCreate = z.object({
  category: z.string().min(2),
  description: z.string().min(5),
  price: z.coerce.number().positive().optional().nullable(),
  is_negotiable: z.boolean().default(false),
  address_text: z.string().min(3),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  images: z.array(z.string().url()).default([]),
});

const QueryNearby = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  radius: z.coerce.number().int().positive().default(5000),
  category: z.string().optional(),
});

export const ordersRouter = Router();

ordersRouter.use(authRequired);

/**
 * POST /orders — создать заказ (только клиент)
 */
ordersRouter.post('/', async (req: AuthedRequest, res) => {
  const parsed = BodyCreate.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid body', detail: parsed.error.flatten() });
  }

  const b = parsed.data;

  // Only clients can create orders
  const profile = req.telegram!;
  if (!profile) return res.status(401).json({ error: 'unauthorized' });

  try {
    const db = getSupabaseAdmin();
    const { data: order, error } = await db
      .from('orders')
      .insert({
        client_id: (await getProfileId(db, profile.user.id))!,
        category: b.category,
        description: b.description,
        price: b.price,
        is_negotiable: b.is_negotiable ?? false,
        address_text: b.address_text,
        geo_location: b.lat != null && b.lng != null
          ? `SRID=4326;POINT(${b.lng} ${b.lat})`
          : null,
        status: 'open',
        images: b.images,
      })
      .select()
      .single();

    if (error) throw error;
    logger.info({ orderId: order.id }, 'order created');
    return res.status(201).json(order);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ msg }, 'order create failed');
    return res.status(500).json({ error: 'create failed', detail: msg });
  }
});

/**
 * GET /orders/nearby — заказы рядом с мастером (PostGIS RPC)
 */
ordersRouter.get('/nearby', async (req: AuthedRequest, res) => {
  const q = QueryNearby.safeParse(req.query);
  if (!q.success) {
    return res.status(400).json({ error: 'invalid query', detail: q.error.flatten() });
  }

  const { lat, lng, radius, category } = q.data;

  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db.rpc('find_orders_nearby', {
      p_lat: lat,
      p_lng: lng,
      p_radius: radius,
      p_category: category ?? null,
    });

    if (error) throw error;
    return res.json(data ?? []);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ msg }, 'orders/nearby failed');
    return res.status(500).json({ error: 'nearby failed', detail: msg });
  }
});

/**
 * GET /orders/:id — детали заказа
 */
ordersRouter.get('/:id', async (req: AuthedRequest, res) => {
  try {
    const db = getSupabaseAdmin();
    const id = req.params.id;
    const { data, error } = await db.from('orders').select('*').eq('id', id).single();

    if (error || !data) return res.status(404).json({ error: 'not found' });
    return res.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return res.status(500).json({ error: msg });
  }
});

/**
 * PATCH /orders/:id/status — сменить статус (клиент)
 */
ordersRouter.patch('/:id/status', async (req: AuthedRequest, res) => {
  const Schema = z.object({ status: z.enum(['open', 'in_progress', 'completed', 'cancelled']) });
  const parsed = Schema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'invalid status' });

  const { status } = parsed.data;

  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('orders')
      .update({ status: status as DBOrderStatus })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ error: 'not found' });
    return res.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return res.status(500).json({ error: msg });
  }
});

async function getProfileId(db: ReturnType<typeof getSupabaseAdmin>, telegramId: number): Promise<string | null> {
  const { data } = await db.from('profiles').select('id').eq('telegram_id', telegramId).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}
