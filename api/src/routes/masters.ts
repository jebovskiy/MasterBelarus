import { Router } from 'express';
import { getSupabaseAdmin } from '../lib/user-client.js';
import { logger } from '../lib/logger.js';
import { jwtRequired, type JwtRequest } from '../middleware/jwt.js';

export const mastersRouter = Router();

mastersRouter.use(jwtRequired);

/**
 * GET /masters/me — текущий мастер: баланс + статистика
 */
mastersRouter.get('/me', async (req: JwtRequest, res) => {
  const profileId = req.jwtPayload?.profile_id;
  if (!profileId) return res.status(401).json({ error: 'unauthorized' });

  try {
    const db = getSupabaseAdmin();

    const { data: balance, error: balErr } = await db
      .from('master_balances')
      .select('response_credits, total_spent')
      .eq('master_id', profileId)
      .maybeSingle();

    if (balErr) throw balErr;

    // Find order_ids where master has accepted bid (orders table has no master_id column)
    const { data: myBidRows, error: bidErr } = await db
      .from('bids')
      .select('order_id')
      .eq('master_id', profileId)
      .eq('status', 'accepted');

    if (bidErr) throw bidErr;

    const myOrderIds = (myBidRows ?? []).map((r) => (r as { order_id: string }).order_id);

    const { count: completedCount, error: compErr } = await db
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('id', myOrderIds.length > 0 ? myOrderIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('status', 'completed');

    if (compErr) throw compErr;

    const { count: inProgressCount, error: ipErr } = await db
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('id', myOrderIds.length > 0 ? myOrderIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('status', 'in_progress');

    if (ipErr) throw ipErr;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count: todayBids, error: tbErr } = await db
      .from('bids')
      .select('*', { count: 'exact', head: true })
      .eq('master_id', profileId)
      .gte('created_at', todayStart.toISOString());

    if (tbErr) throw tbErr;

    return res.json({
      balance: balance ? (balance as { response_credits: number; total_spent: number }).response_credits : 0,
      stats: {
        completed: completedCount ?? 0,
        inProgress: inProgressCount ?? 0,
        todayBids: todayBids ?? 0,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return res.status(500).json({ error: msg });
  }
});

/**
 * GET /masters/me/reviews — отзывы о текущем мастере (с информацией о клиенте)
 */
mastersRouter.get('/me/reviews', async (req: JwtRequest, res) => {
  const profileId = req.jwtPayload!.profile_id;

  try {
    const db = getSupabaseAdmin();

    const { data: reviews, error: revErr } = await db
      .from('reviews')
      .select('id, order_id, client_id, rating, comment, created_at')
      .eq('master_id', profileId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (revErr) throw revErr;

    if (!reviews || reviews.length === 0) {
      return res.json([]);
    }

    const clientIds = [...new Set(reviews.map((r: { client_id: string }) => r.client_id))];

    const { data: clients } = await db
      .from('profiles')
      .select('id, full_name, username, avatar_url')
      .in('id', clientIds);

    const clientMap = new Map<string, { full_name: string | null; username: string | null; avatar_url: string | null }>();
    for (const c of clients ?? []) {
      const row = c as { id: string; full_name: string | null; username: string | null; avatar_url: string | null };
      clientMap.set(row.id, row);
    }

    const result = (reviews ?? []).map((r: { client_id: string; rating: number; comment: string | null; created_at: string; id: string; order_id: string }) => ({
      id: r.id,
      order_id: r.order_id,
      rating: r.rating,
      comment: r.comment,
      created_at: r.created_at,
      client: clientMap.get(r.client_id) ?? null,
    }));

    return res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ msg }, 'masters/me/reviews failed');
    return res.status(500).json({ error: msg });
  }
});

/**
 * GET /masters/:masterId/profile — публичный профиль мастера с агрегатами.
 */
mastersRouter.get('/:masterId/profile', async (req: JwtRequest, res) => {
  const masterId = req.params.masterId;

  try {
    const db = getSupabaseAdmin();

    const { data: profile, error: profileErr } = await db
      .from('profiles')
      .select('id, full_name, username, avatar_url, is_npd, role, avg_rating, review_count')
      .eq('id', masterId)
      .single();

    if (profileErr || !profile) {
      return res.status(404).json({ error: 'master not found' });
    }

    const { data: categories, error: catErr } = await db
      .from('master_categories')
      .select('category')
      .eq('master_id', masterId);

    if (catErr) throw catErr;

    const { data: balance, error: balErr } = await db
      .from('master_balances')
      .select('response_credits, total_spent')
      .eq('master_id', masterId)
      .single();

    if (balErr) {
      // balance row may not exist yet if onboarding didn't run
    }

    return res.json({
      profile: {
        id: (profile as { id: string }).id,
        full_name: (profile as { full_name: string | null }).full_name,
        username: (profile as { username: string | null }).username,
        avatar_url: (profile as { avatar_url: string | null }).avatar_url,
        is_npd: (profile as { is_npd: boolean }).is_npd,
        avg_rating: (profile as { avg_rating: number | null }).avg_rating,
        review_count: (profile as { review_count: number }).review_count,
        categories: (categories ?? []).map((c) => (c as { category: string }).category),
        balance: balance ?? null,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return res.status(500).json({ error: msg });
  }
});
