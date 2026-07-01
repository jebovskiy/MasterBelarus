import { logger } from '../lib/logger.js';

type BidNotificationPayload = {
  telegramId: number;
  category: string;
  masterName: string;
  snippet: string;
};

/**
 * Stub for bid notifications. Sprint 3 wires telegraf bot instance here.
 */
export async function sendBidNotification({
  telegramId,
  category,
  masterName,
  snippet,
}: BidNotificationPayload): Promise<void> {
  // In production: use bot.telegram.sendMessage(telegramId, text, { reply_markup: ... })
  logger.info(
    { telegramId, category, masterName },
    `[NOTIFY] client ${telegramId}: new bid for "${category}" from ${masterName} — "${snippet.slice(0, 60)}"`,
  );
}
