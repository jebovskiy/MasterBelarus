import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { getUserClient, getSupabaseAdmin } from '../lib/user-client.js';
import { logger } from '../lib/logger.js';
import { jwtRequired, type JwtRequest } from '../middleware/jwt.js';
import { isValidCity } from '../data/belarus-cities.js';
import { captureEvent } from '../lib/analytics.js';

const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String((req as JwtRequest).jwtPayload?.telegram_id ?? req.ip),
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

ordersRouter.use(jwtRequired);
ordersRouter.post('/', orderLimiter);

/**
 * POST /orders — создать заказ (только клиент)
 */
ordersRouter.post('/', async (req: JwtRequest, res) => {
  const parsed = BodyCreate.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid body', detail: parsed.error.flatten() });
  }

  const b = parsed.data;
  const profileId = req.jwtPayload!.profile_id;

  try {
    const db = getUserClient(req.jwtToken!);
    const { data: order, error } = await db
      .from('orders')
      .insert({
        client_id: profileId,
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
    captureEvent(`tg_${req.jwtPayload!.telegram_id}`, 'order_created', {
      order_id: order.id,
      category: b.category,
      has_price: b.price != null,
    });
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
ordersRouter.get('/my', async (req: JwtRequest, res) => {
  try {
    const db = getUserClient(req.jwtToken!);
    const profileId = req.jwtPayload!.profile_id;
    const limit = Math.min(Number(req.query.limit ?? 20), 100);

    const { data: orders, error } = await db
      .from('orders')
      .select('*')
      .eq('client_id', profileId)
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
ordersRouter.get('/nearby', async (req: JwtRequest, res) => {
  const q = QueryNearby.safeParse(req.query);
  if (!q.success) {
    return res.status(400).json({ error: 'invalid query', detail: q.error.flatten() });
  }

  const { lat, lng, radius, category, city } = q.data;

  try {
    const dbAdmin = getSupabaseAdmin();
    const limit = Math.min(Number(req.query.limit ?? 100), 500);

    const { data, error } = await dbAdmin.rpc('find_orders_nearby', {
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
 * GET /orders/chats — список чатов для текущего пользователя
 * Показывает заказы in_progress даже без сообщений.
 * Возвращает описание заказа + имя собеседника.
 */
ordersRouter.get('/chats', async (req: JwtRequest, res) => {
  try {
    const db = getUserClient(req.jwtToken!);
    const profileId = req.jwtPayload!.profile_id;

    // Заказы пользователя (как клиент + как принятый мастер)
    const { data: asClient } = await db
      .from('orders')
      .select('id, category, description, price, client_id, status')
      .eq('client_id', profileId)
      .in('status', ['in_progress', 'completed', 'cancelled']);

    const { data: acceptedBids } = await db
      .from('bids')
      .select('order_id')
      .eq('master_id', profileId)
      .eq('status', 'accepted');

    const bidIds = (acceptedBids ?? []).map((b: { order_id: string }) => b.order_id);
    let asMaster: { id: string; category: string; description: string; price: number | null; client_id: string; status: string }[] = [];
    if (bidIds.length > 0) {
      const { data: mo } = await db
        .from('orders')
        .select('id, category, description, price, client_id, status')
        .in('id', bidIds)
        .in('status', ['in_progress', 'completed', 'cancelled']);
      asMaster = (mo ?? []) as typeof asMaster;
    }

    // Merge + dedup
    const seen = new Set<string>();
    const allOrders = [...(asClient ?? []), ...asMaster].filter((o) => {
      if (seen.has(o.id)) return false;
      seen.add(o.id);
      return true;
    });
    if (allOrders.length === 0) return res.json({ conversations: [] });

    // Последние сообщения
    const orderIds = allOrders.map((o) => o.id);
    const { data: latestMessages } = await db
      .from('messages')
      .select('order_id, text, created_at')
      .in('order_id', orderIds)
      .order('created_at', { ascending: false });

    const latestMap = new Map<string, { text: string; created_at: string }>();
    for (const m of (latestMessages ?? []) as { order_id: string; text: string; created_at: string }[]) {
      if (!latestMap.has(m.order_id)) latestMap.set(m.order_id, { text: m.text, created_at: m.created_at });
    }

    // Собираем ID собеседников: для заказов-клиента → accepted master, для заказов-мастера → client
    const clientIds = new Set<string>();
    const masterNeeded = new Set<string>();
    for (const o of allOrders) {
      if (o.client_id === profileId) {
        masterNeeded.add(o.id);
      } else {
        clientIds.add(o.client_id);
      }
    }

    // Получаем accepted мастеров для заказов клиента
    const masterMap = new Map<string, string>(); // order_id → master_name
    if (masterNeeded.size > 0) {
      const { data: mastersBids } = await db
        .from('bids')
        .select('order_id, master_id')
        .in('order_id', [...masterNeeded])
        .eq('status', 'accepted');

      const masterIds = [...new Set((mastersBids ?? []).map((b: { master_id: string }) => b.master_id))];
      if (masterIds.length > 0) {
        const { data: mastersProfiles } = await db
          .from('profiles')
          .select('id, full_name')
          .in('id', masterIds);

        const nameMap = new Map((mastersProfiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]));
        for (const b of (mastersBids ?? []) as { order_id: string; master_id: string }[]) {
          masterMap.set(b.order_id, nameMap.get(b.master_id) ?? 'Мастер');
        }
      }
    }

    // Получаем имена клиентов
    const clientNameMap = new Map<string, string>();
    if (clientIds.size > 0) {
      const { data: clients } = await db
        .from('profiles')
        .select('id, full_name')
        .in('id', [...clientIds]);

      for (const c of (clients ?? []) as { id: string; full_name: string | null }[]) {
        clientNameMap.set(c.id, c.full_name ?? 'Клиент');
      }
    }

    // Собираем результат
    const conversations = allOrders.map((o) => {
      const msg = latestMap.get(o.id);
      const isClient = o.client_id === profileId;
      const otherName = isClient
        ? (masterMap.get(o.id) ?? 'Мастер')
        : (clientNameMap.get(o.client_id) ?? 'Клиент');

      return {
        order_id: o.id,
        category: o.category,
        description: o.description.slice(0, 80),
        price: o.price,
        status: o.status,
        other_participant_name: otherName,
        last_message: msg?.text ?? '',
        last_message_at: msg?.created_at ?? new Date(0).toISOString(),
        unread: 0,
      };
    }).sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());

    return res.json({ conversations });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ msg }, 'orders/chats failed');
    return res.status(500).json({ error: msg });
  }
});

/**
 * GET /orders/in-progress — заказы в работе у текущего мастера
 * MUST be before /:id to avoid route conflict
 */
ordersRouter.get('/in-progress', async (req: JwtRequest, res) => {
  try {
    const db = getUserClient(req.jwtToken!);
    const profileId = req.jwtPayload!.profile_id;

    const { data: myBids } = await db
      .from('bids')
      .select('order_id')
      .eq('master_id', profileId);

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

/**
 * GET /orders/:id — детали заказа (доступно всем аутентифицированным)
 */
ordersRouter.get('/:id', async (req: JwtRequest, res) => {
  try {
    const db = getUserClient(req.jwtToken!);
    const id = req.params.id;

    const { data: order, error } = await db.from('orders').select('*').eq('id', id).single();
    if (error || !order) return res.status(404).json({ error: 'not found' });

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
