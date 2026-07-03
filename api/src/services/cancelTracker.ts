import { logger } from '../lib/logger.js';

const windowMs = 24 * 60 * 60 * 1000;
const MAX_CANCELLATIONS = 3;

type Entry = { count: number; timestamp: number };

const store = new Map<number, Entry>();

export function checkCancelRate(telegramId: number): { allowed: boolean; count: number; reason: string | null } {
  const now = Date.now();
  const entry = store.get(telegramId);

  if (!entry || now - entry.timestamp > windowMs) {
    store.set(telegramId, { count: 1, timestamp: now });
    return { allowed: true, count: 1, reason: null };
  }

  const newCount = entry.count + 1;
  store.set(telegramId, { count: newCount, timestamp: entry.timestamp });

  if (newCount > MAX_CANCELLATIONS) {
    logger.warn({ telegramId, count: newCount }, 'cancel rate limit exceeded');
    return { allowed: false, count: newCount, reason: 'Слишком много отмен за 24 часа' };
  }

  return { allowed: true, count: newCount, reason: null };
}
