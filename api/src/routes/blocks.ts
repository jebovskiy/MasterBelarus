import { Router } from 'express';
import { getSupabaseAdmin } from '../lib/user-client.js';
import { logger } from '../lib/logger.js';
import { jwtRequired, type JwtRequest } from '../middleware/jwt.js';

export const blocksRouter = Router();
blocksRouter.use(jwtRequired);

/**
 * GET /blocks — список заблокированных мной
 */
blocksRouter.get('/', async (req: JwtRequest, res) => {
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('blocked_users')
      .select('id, blocked_id, created_at')
      .eq('blocker_id', req.jwtPayload!.profile_id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const blockedIds = (data ?? []).map((r: { blocked_id: string }) => r.blocked_id);
    let profiles: { id: string; full_name: string | null; avatar_url: string | null }[] = [];
    if (blockedIds.length > 0) {
      const { data: p } = await db.from('profiles').select('id, full_name, avatar_url').in('id', blockedIds);
      profiles = (p ?? []) as typeof profiles;
    }
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    const blocks = (data ?? []).map((r: { id: string; blocked_id: string; created_at: string }) => ({
      id: r.id,
      blocked_id: r.blocked_id,
      blocked_name: profileMap.get(r.blocked_id)?.full_name ?? 'Пользователь',
      blocked_avatar: profileMap.get(r.blocked_id)?.avatar_url ?? null,
      created_at: r.created_at,
    }));

    return res.json({ blocks });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ msg }, 'blocks list failed');
    return res.status(500).json({ error: msg });
  }
});

/**
 * POST /blocks/:userId — заблокировать
 */
blocksRouter.post('/:userId', async (req: JwtRequest, res) => {
  const { userId } = req.params;
  const blockerId = req.jwtPayload!.profile_id;
  if (userId === blockerId) return res.status(400).json({ error: 'cannot block yourself' });

  try {
    const db = getSupabaseAdmin();
    const { error } = await db.from('blocked_users').insert({ blocker_id: blockerId, blocked_id: userId });
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'already blocked' });
      throw error;
    }
    return res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ msg }, 'block user failed');
    return res.status(500).json({ error: msg });
  }
});

/**
 * DELETE /blocks/:userId — разблокировать
 */
blocksRouter.delete('/:userId', async (req: JwtRequest, res) => {
  const { userId } = req.params;
  const blockerId = req.jwtPayload!.profile_id;

  try {
    const db = getSupabaseAdmin();
    const { error } = await db.from('blocked_users').delete()
      .eq('blocker_id', blockerId).eq('blocked_id', userId);
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ msg }, 'unblock user failed');
    return res.status(500).json({ error: msg });
  }
});

/**
 * GET /chats/hidden — скрытые чаты
 */
blocksRouter.get('/chats/hidden', async (req: JwtRequest, res) => {
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('hidden_chats')
      .select('id, order_id, created_at')
      .eq('profile_id', req.jwtPayload!.profile_id);
    if (error) throw error;
    return res.json({ hidden: (data ?? []).map((r: { order_id: string }) => r.order_id) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ msg }, 'hidden chats list failed');
    return res.status(500).json({ error: msg });
  }
});

/**
 * POST /chats/hide/:orderId — скрыть чат
 */
blocksRouter.post('/chats/hide/:orderId', async (req: JwtRequest, res) => {
  const { orderId } = req.params;
  const profileId = req.jwtPayload!.profile_id;

  try {
    const db = getSupabaseAdmin();
    const { error } = await db.from('hidden_chats').insert({ profile_id: profileId, order_id: orderId });
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'already hidden' });
      throw error;
    }
    return res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ msg }, 'hide chat failed');
    return res.status(500).json({ error: msg });
  }
});

/**
 * DELETE /chats/hide/:orderId — вернуть чат
 */
blocksRouter.delete('/chats/hide/:orderId', async (req: JwtRequest, res) => {
  const { orderId } = req.params;
  const profileId = req.jwtPayload!.profile_id;

  try {
    const db = getSupabaseAdmin();
    const { error } = await db.from('hidden_chats').delete()
      .eq('profile_id', profileId).eq('order_id', orderId);
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ msg }, 'unhide chat failed');
    return res.status(500).json({ error: msg });
  }
});
