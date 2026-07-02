import { Router } from 'express';
import { z } from 'zod';
import type { AdminRequest } from '../middleware/admin.js';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { adminRequired } from '../middleware/admin.js';
import { notifyMasterApproved } from '../services/notifications.js';

export const adminRouter = Router();

adminRouter.use(adminRequired);

/**
 * POST /admin/masters/approve/:telegramId — одобрить заявку мастера
 */
adminRouter.post('/masters/approve/:telegramId', async (req, res) => {
  const telegramId = Number(req.params.telegramId);
  if (!telegramId) return res.status(400).json({ error: 'invalid telegramId' });
  try {
    const db = getSupabaseAdmin();
    const { error } = await db
      .from('profiles')
      .update({ is_master: true, master_status: 'approved', current_role: 'master' })
      .eq('telegram_id', telegramId);
    if (error) throw error;
    logger.info({ admin: (req as any).admin, telegramId }, 'admin: master approved');

    await notifyMasterApproved(telegramId);

    return res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return res.status(500).json({ error: msg });
  }
});

/**
 * POST /admin/masters/reject/:telegramId — отклонить заявку мастера
 */
adminRouter.post('/masters/reject/:telegramId', async (req, res) => {
  const telegramId = Number(req.params.telegramId);
  if (!telegramId) return res.status(400).json({ error: 'invalid telegramId' });
  try {
    const db = getSupabaseAdmin();
    const { error } = await db
      .from('profiles')
      .update({ master_status: 'rejected' })
      .eq('telegram_id', telegramId);
    if (error) throw error;
    logger.info({ admin: (req as any).admin, telegramId }, 'admin: master rejected');

    const { getBot } = await import('../services/botRegistry.js');
    const bot = getBot();
    await bot.telegram.sendMessage(telegramId,
      '❌ К сожалению, ваша заявка на статус мастера отклонена.\n' +
      'Свяжитесь с поддержкой для уточнения причины.'
    );

    return res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return res.status(500).json({ error: msg });
  }
});

/**
 * GET /admin/masters/pending — список заявок на модерации
 */
adminRouter.get('/masters/pending', async (_req, res) => {
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('profiles')
      .select('id, telegram_id, full_name, phone, username, city, category, master_status, created_at')
      .eq('master_status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json(data ?? []);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return res.status(500).json({ error: msg });
  }
});

/**
 * GET /admin/stats — агрегированная статистика
 */
adminRouter.get('/stats', async (_req: AdminRequest, res) => {
  try {
    const db = getSupabaseAdmin();
    const [{ count: users }, { count: masters }, { count: orders }, { count: bids }] = await Promise.all([
      db.from('profiles').select('*', { count: 'exact', head: true }),
      db.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'master'),
      db.from('orders').select('*', { count: 'exact', head: true }),
      db.from('bids').select('*', { count: 'exact', head: true }),
    ]);

    return res.json({
      users: users ?? 0,
      masters: masters ?? 0,
      orders: orders ?? 0,
      bids: bids ?? 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return res.status(500).json({ error: msg });
  }
});

/**
 * GET /admin/orders — последние N заказов
 */
adminRouter.get('/orders', async (req: AdminRequest, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('orders')
      .select('id, category, status, price, created_at, client_id')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return res.json(data ?? []);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return res.status(500).json({ error: msg });
  }
});

/**
 * PATCH /admin/orders/:id/status — смена статуса (модерация)
 */
adminRouter.patch('/orders/:id/status', async (req: AdminRequest, res) => {
  const Schema = z.object({ status: z.enum(['open', 'in_progress', 'completed', 'cancelled']) });
  const parsed = Schema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'invalid body' });

  const orderId = req.params.id;
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('orders')
      .update({ status: parsed.data.status as 'open' | 'in_progress' | 'completed' | 'cancelled' })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;
    logger.info({ admin: req.admin, orderId, status: parsed.data.status }, 'admin: order status changed');
    return res.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return res.status(500).json({ error: msg });
  }
});

/**
 * GET /admin/masters — список мастеров
 */
adminRouter.get('/masters', async (req: AdminRequest, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('profiles')
      .select('id, full_name, username, role, is_npd, created_at, avg_rating, review_count')
      .eq('role', 'master')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return res.json(data ?? []);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return res.status(500).json({ error: msg });
  }
});
