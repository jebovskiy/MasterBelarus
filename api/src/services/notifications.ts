import { logger } from '../lib/logger.js';
import type { Telegraf } from 'telegraf';

let bot: Telegraf | null = null;

export function initNotificationService(b: Telegraf) {
  bot = b;
}

type BidNotificationPayload = {
  telegramId: number;
  category: string;
  masterName: string;
  snippet: string;
};

export async function sendBidNotification({
  telegramId,
  category,
  masterName,
  snippet,
}: BidNotificationPayload): Promise<void> {
  if (!bot) {
    logger.info({ telegramId, category, masterName }, '[NOTIFY] stub: no bot wired');
    return;
  }

  try {
    await bot.telegram.sendMessage(
      telegramId,
      `🔔 Новый отклик на ваш заказ «${category}»\n\n` +
        `Мастер: ${masterName}\n` +
        `«${snippet.slice(0, 120)}»\n\n` +
        `Откройте приложение, чтобы принять мастера.`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Открыть МастерБай',
                web_app: { url: 'http://localhost:3000' },
              },
            ],
          ],
        },
        parse_mode: 'HTML',
      },
    );
    logger.info({ telegramId }, 'bid notification sent');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ telegramId, msg }, 'bid notification failed');
  }
}

export async function sendMasterAcceptedNotification(
  telegramId: number,
  category: string,
  proposedPrice: number | null,
): Promise<void> {
  if (!bot) {
    logger.info({ telegramId }, '[NOTIFY] stub: no bot wired');
    return;
  }

  try {
    const text =
      `✅ Ваш отклик принят!\n\n` +
      `Категория: ${category}\n` +
      `Цена: ${proposedPrice ? proposedPrice + ' BYN' : 'По договоренности'}\n\n` +
      `Клиент ждёт — свяжитесь с ним в приложении.`;

    await bot.telegram.sendMessage(telegramId, text, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: 'Открыть чат',
              web_app: { url: 'http://localhost:3000' },
            },
          ],
        ],
      },
    });
    logger.info({ telegramId }, 'accepted notification sent');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ telegramId, msg }, 'accepted notification failed');
  }
}
