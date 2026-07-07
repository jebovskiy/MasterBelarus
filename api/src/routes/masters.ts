import { Router } from 'express';
import { getSupabaseAdmin } from '../lib/user-client.js';
import { jwtRequired, type JwtRequest } from '../middleware/jwt.js';

export const mastersRouter = Router();

mastersRouter.use(jwtRequired);

/**
 * GET /masters/:masterId/profile — публичный профиль мастера с агрегатами.
 * Доступ: любой авторизованный пользователь.
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
