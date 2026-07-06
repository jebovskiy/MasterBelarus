import { Router } from 'express';
import { getSupabaseAdmin } from '../lib/user-client.js';
import { logger } from '../lib/logger.js';
import { jwtRequired, type JwtRequest } from '../middleware/jwt.js';

export const readRouter = Router();

readRouter.use(jwtRequired);

/**
 * POST /orders/:orderId/read — отметить сообщения чата как прочитанные
 */
readRouter.post('/:orderId/read', async (req: JwtRequest, res) => {
  const { orderId } = req.params;
  const profileId = req.jwtPayload!.profile_id;

  try {
    const db = getSupabaseAdmin();

    const { error } = await db
      .from('chat_read_state')
      .upsert(
        { order_id: orderId, profile_id: profileId, last_read_at: new Date().toISOString() },
        { onConflict: 'order_id,profile_id' },
      );

    if (error) throw error;
    return res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ msg }, 'mark read failed');
    return res.status(500).json({ error: msg });
  }
});
