import { getSupabaseAdmin } from '../lib/user-client.js';
import { logger } from '../lib/logger.js';

export async function checkCancelRate(telegramId: number): Promise<{ allowed: boolean; count: number; reason: string | null }> {
  const db = getSupabaseAdmin();

  const { data, error } = await db.rpc('check_cancel_rate', { p_telegram_id: telegramId });

  if (error || !data) {
    logger.error({ telegramId, error: error?.message }, 'check_cancel_rate RPC failed');
    return { allowed: true, count: 1, reason: null };
  }

  const result = data as { allowed: boolean; count: number };
  if (!result.allowed) {
    logger.warn({ telegramId, count: result.count }, 'cancel rate limit exceeded');
    return { allowed: false, count: result.count, reason: 'Слишком много отмен за 24 часа' };
  }

  return { allowed: true, count: result.count, reason: null };
}
