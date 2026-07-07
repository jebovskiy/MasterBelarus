import { Markup } from 'telegraf';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.js';
import type { Telegraf } from 'telegraf';

let bot: Telegraf | null = null;

export function initNotificationService(b: Telegraf) {
  bot = b;
}

type BidNotificationPayload = {
  telegramId: number;
  masterName: string;
  rating?: number;
  price?: number | null;
  orderId: string;
};

export async function sendBidNotification({
  telegramId,
  masterName,
  rating,
  price,
  orderId,
}: BidNotificationPayload): Promise<void> {
  if (!bot) {
    logger.info({ telegramId, masterName }, '[NOTIFY] stub: no bot wired');
    return;
  }

  const lines = ['🔔 Новый отклик на ваш заказ'];
  lines.push(`Мастер: ${masterName}`);
  if (rating) lines.push(`Рейтинг: ${'★'.repeat(Math.round(rating))} ${rating.toFixed(1)}`);
  if (price) lines.push(`Цена: ${price} BYN`);
  lines.push('');

  try {
    await bot.telegram.sendMessage(telegramId, lines.join('\n'), {
      reply_markup: {
        inline_keyboard: [[
          {
            text: '🔍 Посмотреть отклик',
            web_app: { url: `${env.PUBLIC_WEB_URL}?startapp=order_${orderId}` },
          },
        ]],
      },
    });
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
  orderId: string,
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
        inline_keyboard: [[
          {
            text: 'Открыть чат',
            web_app: { url: `${env.PUBLIC_WEB_URL}?startapp=order_${orderId}` },
          },
        ]],
      },
    });
    logger.info({ telegramId }, 'accepted notification sent');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ telegramId, msg }, 'accepted notification failed');
  }
}

export async function sendChatMessageNotification(
  telegramId: number,
  senderName: string,
  text: string,
  orderId: string,
): Promise<void> {
  if (!bot) {
    logger.info({ telegramId }, '[NOTIFY] stub: no bot wired');
    return;
  }

  try {
    const preview = text.length > 80 ? text.slice(0, 77) + '...' : text;
    await bot.telegram.sendMessage(telegramId,
      `💬 Новое сообщение от ${senderName}\n\n${preview}`, {
        reply_markup: {
          inline_keyboard: [[
            {
              text: '📬 Ответить',
              web_app: { url: `${env.PUBLIC_WEB_URL}?startapp=order_${orderId}` },
            },
          ]],
        },
      },
    );
    logger.info({ telegramId, orderId }, 'chat message notification sent');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ telegramId, msg }, 'chat message notification failed');
  }
}

export async function notifyMasterApproved(telegramId: number): Promise<void> {
  if (!bot) {
    logger.info({ telegramId }, '[NOTIFY] stub: no bot wired');
    return;
  }

  try {
    await bot.telegram.sendMessage(telegramId,
      '🎉 Ваша заявка на статус мастера одобрена!\n\n' +
      'Вам начислен стартовый баланс откликов.\n' +
      'Откройте ленту заказов, чтобы начать зарабатывать.',
      {
        reply_markup: {
          inline_keyboard: [[
            {
              text: '📋 Открыть ленту заказов',
              web_app: { url: `${env.PUBLIC_WEB_URL}?startapp=master_feed` },
            },
          ]],
        },
      },
    );
    logger.info({ telegramId }, 'master approved notification sent');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ telegramId, msg }, 'master approved notification failed');
  }
}

export async function notifyLowBalance(telegramId: number, balance: number): Promise<void> {
  if (!bot) return;
  try {
    await bot.telegram.sendMessage(telegramId,
      `⚠️ У вас осталось всего ${balance} откликов.\n` +
      'Пополните баланс, чтобы продолжить откликаться на заказы.',
      {
        reply_markup: {
          inline_keyboard: [[
            {
              text: '💰 Пополнить',
              web_app: { url: `${env.PUBLIC_WEB_URL}?startapp=topup` },
            },
          ]],
        },
      },
    );
  } catch (err) {
    logger.warn({ telegramId, err }, 'low balance notification failed');
  }
}

export async function sendOrderCancelledToMasters(
  mastersTgIds: number[],
  orderId: string,
  category: string,
  reasonLabel: string,
): Promise<void> {
  if (!bot) return;
  const text =
    `📢 Заказ №${orderId.slice(0, 8)} ["${category}"] был отменен заказчиком.\n` +
    `Причина: ${reasonLabel}\n\nНе ждите ответа.`;

  for (const tgId of mastersTgIds) {
    try {
      await bot.telegram.sendMessage(tgId, text);
      logger.info({ telegramId: tgId }, 'cancel notification sent to master');
    } catch (err) {
      logger.warn({ telegramId: tgId, err }, 'cancel notify master failed');
    }
  }
}

export async function sendMasterCancelledToClient(
  clientTgId: number,
  orderId: string,
  reasonLabel: string,
): Promise<void> {
  if (!bot) return;
  try {
    await bot.telegram.sendMessage(clientTgId,
      `❌ Мастер отменил выполнение заказа №${orderId.slice(0, 8)}.\n` +
      `Причина: ${reasonLabel}\n\nВы можете перезапустить поиск мастера.`,
      {
        reply_markup: {
          inline_keyboard: [[
            {
              text: '🔄 Вернуть заказ в поиск',
              web_app: { url: `${env.PUBLIC_WEB_URL}?startapp=reactive_order_${orderId}` },
            },
          ]],
        },
      },
    );
    logger.info({ clientTgId, orderId }, 'master cancelled notification sent to client');
  } catch (err) {
    logger.warn({ clientTgId, err }, 'notify client about master cancel failed');
  }
}

export async function sendRefundNotification(telegramId: number, masterName: string, orderId: string): Promise<void> {
  if (!bot) return;
  try {
    await bot.telegram.sendMessage(telegramId,
      `🔄 Баланс восстановлен.\nЗаказ №${orderId.slice(0, 8)} был отменён заказчиком как ошибочный.\n\nСписание отклика за отменённый заказ отменено.`,
    );
  } catch (err) {
    logger.warn({ telegramId, err }, 'refund notification failed');
  }
}

type ComplaintPayload = {
  id: string;
  userName: string;
  userRole: string;
  text: string;
  accusedTgId?: number;
};

export async function notifyComplaintToModerator(payload: ComplaintPayload): Promise<void> {
  const chatId = env.MODERATOR_CHAT_ID;
  if (!bot || !chatId) {
    logger.info({ payload }, '[COMPLAINT] stub: no bot or MODERATOR_CHAT_ID');
    return;
  }

  try {
    await bot.telegram.sendMessage(chatId,
      `🆕 <b>Новая жалоба</b>\n\n` +
      `От: ${payload.userName} (${payload.userRole})\n` +
      `Текст: ${payload.text}\n` +
      (payload.accusedTgId ? `ID нарушителя: ${payload.accusedTgId}` : ''),
      {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
          [
            Markup.button.callback('🚫 Заблокировать', `block_complaint:${payload.id}:${payload.accusedTgId ?? 0}`),
            Markup.button.callback('✅ Отклонить', `dismiss_complaint:${payload.id}`),
          ],
        ]).reply_markup,
      },
    );
    logger.info({ complaintId: payload.id }, 'complaint forwarded to moderator');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.warn({ complaintId: payload.id, msg }, 'complaint forwarding failed');
  }
}
