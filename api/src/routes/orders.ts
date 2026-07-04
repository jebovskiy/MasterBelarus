import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import type { AuthedRequest } from '../middleware/auth.js';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { authRequired } from '../middleware/auth.js';
import { isValidCity } from '../data/belarus-cities.js';

const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String((req as AuthedRequest).telegram?.user?.id ?? req.ip),
  message: { error: 'too many orders, try later' },
});

function extractCityFromAddress(address: string): string | null {
  // address_text формат: "г. Минск, Московский р-н, ул. Братская 1"
  const m = address.match(/^г\.\s*(.+?)(?:[,，]|$)/);
  return m?.[1]?.trim() ?? null;
}

const BodyCreate = z.object({
  category: z.string().min(2),
  description: z.string().min(5),
  price: z.coerce.number().positive().optional().nullable(),
  is_negotiable: z.boolean().default(false),
  address_text: z.string().min(3).refine((addr) => {
    const city = extractCityFromAddress(addr);
    return city !== null && isValidCity(city);
  }, { message: 'город в address_text не поддерживается' }),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  images: z.array(z.string().url()).default([]),
});

const QueryNearby = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  radius: z.coerce.number().int().positive().default(5000),
  category: z.string().optional(),
  city: z.string().optional().refine((c) => !c || isValidCity(c), { message: 'неподдерживаемый город' }),
});

export const ordersRouter = Router();

ordersRouter.use(authRequired);
ordersRouter.post('/', orderLimiter);

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
 * GET /orders/my — заказы текущего пользователя
 */
ordersRouter.get('/my', async (req: AuthedRequest, res) => {
  try {
    const db = getSupabaseAdmin();
    const { data: profile } = await db
      .from('profiles')
      .select('id')
      .eq('telegram_id', req.telegram!.user.id)
      .single();

    if (!profile) return res.status(404).json({ error: 'profile not found' });

    const limit = Math.min(Number(req.query.limit ?? 20), 100);

    const { data: orders, error } = await db
      .from('orders')
      .select('*')
      .eq('client_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return res.json({ orders: orders ?? [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ msg }, 'orders/my failed');
    return res.status(500).json({ error: 'my orders failed', detail: msg });
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

  const { lat, lng, radius, category, city } = q.data;

  try {
    const db = getSupabaseAdmin();
    const limit = Math.min(Number(req.query.limit ?? 100), 500);

    const { data, error } = await db.rpc('find_orders_nearby', {
      p_lat: lat,
      p_lng: lng,
      p_radius: radius,
      p_category: category ?? null,
      p_city: city ?? null,
      p_limit: limit,
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
 * GET /orders/:id — детали заказа (только владелец, мастер с откликом или админ)
 */
ordersRouter.get('/:id', async (req: AuthedRequest, res) => {
  try {
    const db = getSupabaseAdmin();
    const id = req.params.id;

    const { data: profile } = await db
      .from('profiles')
      .select('id')
      .eq('telegram_id', req.telegram!.user.id)
      .single();
    if (!profile) return res.status(404).json({ error: 'profile not found' });

    const { data: order, error } = await db.from('orders').select('*').eq('id', id).single();
    if (error || !order) return res.status(404).json({ error: 'not found' });

    const ownOrder = (order as { client_id: string }).client_id === profile.id;

    const { data: myBid } = await db
      .from('bids')
      .select('id')
      .eq('order_id', id)
      .eq('master_id', profile.id)
      .maybeSingle();

    if (!ownOrder && !myBid) return res.status(403).json({ error: 'forbidden' });

    return res.json(order);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return res.status(500).json({ error: msg });
  }
});

/**
 * PATCH /orders/:id/status — сменить статус (только владелец)
 * Удалён из-за IDOR. Для смены статуса используйте:
 *   POST /orders/:id/cancel — отмена
 *   POST /orders/:id/accept-bid/:bidId — принятие
 *   POST /orders/:id/review — завершение + отзыв
 */

/**
 * GET /orders/in-progress — заказы в работе у текущего мастера
 */
ordersRouter.get('/in-progress', async (req: AuthedRequest, res) => {
  try {
    const db = getSupabaseAdmin();
    const { data: profile } = await db
      .from('profiles')
      .select('id')
      .eq('telegram_id', req.telegram!.user.id)
      .single();

    if (!profile) return res.status(404).json({ error: 'profile not found' });

    const { data: myBids } = await db
      .from('bids')
      .select('order_id')
      .eq('master_id', profile.id);

    const orderIds = (myBids ?? []).map((b: { order_id: string }) => b.order_id);
    if (orderIds.length === 0) return res.json({ orders: [] });

    const limit = Math.min(Number(req.query.limit ?? 20), 100);

    const { data: orders, error } = await db
      .from('orders')
      .select('*')
      .in('id', orderIds)
      .eq('status', 'in_progress')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return res.json({ orders: orders ?? [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ msg }, 'orders/in-progress failed');
    return res.status(500).json({ error: 'in-progress failed', detail: msg });
  }
});

async function getProfileId(db: ReturnType<typeof getSupabaseAdmin>, telegramId: number): Promise<string | null> {
  const { data } = await db.from('profiles').select('id').eq('telegram_id', telegramId).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}
