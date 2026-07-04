import { Telegraf, Markup, type Context } from 'telegraf';
import type { AppEnv } from '../config/env.js';
import { getSupabaseAdmin } from '../lib/user-client.js';
import { logger } from '../lib/logger.js';
import { initNotificationService, sendBidNotification, notifyMasterApproved, notifyComplaintToModerator } from '../services/notifications.js';

export { sendBidNotification, notifyComplaintToModerator };

const RULES_TEXT =
  '📋 Правила сервиса МастерБай:\n\n' +
  '• Заказчик создаёт заявку — мастера предлагают цену\n' +
  '• Вы выбираете лучшего мастера по цене и рейтингу\n' +
  '• Контакты открываются после подтверждения заказа\n\n' +
  '👷‍♂️ Мастерам:\n' +
  '• После одобрения вы получаете 20 бесплатных откликов\n' +
  '• Дальше — пополнение в приложении\n\n' +
  '❓ Поддержка: @masterby_support';

function maskPhone(phone?: string | null): string {
  if (!phone) return '+375 (XX) XXX-XX-XX';
  const d = phone.replace(/\D/g, '');
  if (d.length < 7) return phone;
  const code = d.slice(0, 3);
  const op = d.slice(3, 5);
  return `+${code} (${op}) ***-**-${d.slice(-2)}`;
}

async function getStatusText(tgId: number): Promise<string> {
  const db = getSupabaseAdmin();
  const { data: profile } = await db
    .from('profiles')
    .select('id, full_name, role, current_role, is_master, master_status, phone, avg_rating, review_count')
    .eq('telegram_id', tgId)
    .maybeSingle();

  if (!profile) return 'Профиль не найден. Нажмите /start.';

  const roleLabel =
    profile.is_master && profile.master_status === 'approved' ? 'Мастер' :
    profile.master_status === 'pending' ? 'Мастер (ожидает)' :
    'Клиент';

  const statusIcon =
    profile.master_status === 'approved' ? '✅' :
    profile.master_status === 'pending' ? '⏳' :
    profile.master_status === 'rejected' ? '❌' : '';

  const lines = [
    `📋 <b>${profile.full_name || 'Пользователь'}</b>`,
    `Роль: ${roleLabel} ${statusIcon}`,
    `Телефон: ${maskPhone(profile.phone)}`,
  ];

  if (profile.is_master && profile.master_status === 'approved') {
    const { data: bal } = await db
      .from('master_balances')
      .select('response_credits, total_spent')
      .eq('master_id', profile.id)
      .maybeSingle();

    const bb = (bal as { response_credits?: number } | null)?.response_credits ?? 0;
    const te = (bal as { total_spent?: number } | null)?.total_spent ?? 0;
    lines.push(`💰 Откликов: ${bb} | Заработано: ${te} BYN`);
  }

  if (profile.avg_rating) {
    lines.push(`⭐ ${profile.avg_rating.toFixed(1)} (${profile.review_count ?? 0} отзывов)`);
  }

  return lines.join('\n');
}

export function createBot(env: AppEnv): Telegraf<Context> {
  const bot = new Telegraf<Context>(env.BOT_TOKEN);

  initNotificationService(bot);

  // ── /start ──
  bot.start(async (ctx) => {
    const tgUser = ctx.from;
    if (!tgUser) return;

    try {
      const db = getSupabaseAdmin();
      const { data: existing } = await db
        .from('profiles')
        .select('id')
        .eq('telegram_id', tgUser.id)
        .maybeSingle();

      if (!existing) {
        await db.from('profiles').insert({
          telegram_id: tgUser.id,
          username: tgUser.username ?? null,
          full_name: [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || null,
          role: 'client',
          current_role: 'customer',
        });
        logger.info({ telegramId: tgUser.id }, 'profile created via /start');
      }
    } catch (err) {
      logger.warn({ err, telegramId: tgUser.id }, '/start profile upsert failed');
    }

    const payload = ctx.startPayload ?? '';
    let text: string;
    let buttonUrl = env.PUBLIC_WEB_URL;

    if (payload.startsWith('order_')) {
      buttonUrl += `?startapp=${payload}`;
      text = '🔍 У вас новый отклик.\nНажмите кнопку, чтобы посмотреть.';
    } else if (payload === 'master_feed') {
      buttonUrl += '?startapp=master_feed';
      text = '📋 Вы в режиме мастера.\nНажмите кнопку, чтобы открыть ленту заказов.';
    } else if (payload.startsWith('complaint_')) {
      buttonUrl += `?startapp=${payload}`;
      text = '📩 Ваша жалоба получена.\nМодератор рассмотрит её в ближайшее время.';
    } else if (payload.startsWith('reactive_order_')) {
      const orderId = payload.replace('reactive_order_', '');
      buttonUrl += `?startapp=${payload}`;
      text = `🔄 Заказ №${orderId.slice(0, 8)} готов к повторному открытию.\n\nНажмите кнопку, чтобы вернуть его в поиск и найти нового мастера.`;
    } else {
      text = `🛠 Добро пожаловать в МастерБай, ${tgUser.first_name}!\nСоздавайте заявки и находите мастеров рядом.`;
    }

    await ctx.reply(text, {
      reply_markup: {
        inline_keyboard: [[
          { text: '🧰 Открыть МастерБай', web_app: { url: buttonUrl } },
        ]],
      },
    });
  });

  // ── /help ──
  bot.help(async (ctx) => {
    await ctx.reply(RULES_TEXT, {
      reply_markup: {
        inline_keyboard: [[
          { text: '🧰 Открыть приложение', web_app: { url: env.PUBLIC_WEB_URL } },
        ]],
      },
    });
  });

  // ── /menu ──
  bot.command('menu', async (ctx) => {
    await ctx.reply('Выберите действие:', {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.webApp('🧰 Открыть МастерБай', env.PUBLIC_WEB_URL)],
        [Markup.button.callback('📊 Мой статус', 'show_status')],
        [Markup.button.callback('📋 Правила', 'show_rules')],
      ]).reply_markup,
    });
  });

  // ── /status ──
  bot.command('status', async (ctx) => {
    const tgId = ctx.from?.id;
    if (!tgId) return;
    try {
      const text = await getStatusText(tgId);
      await ctx.replyWithHTML(text, {
        reply_markup: {
          inline_keyboard: [[
            { text: '🧰 Открыть приложение', web_app: { url: env.PUBLIC_WEB_URL } },
          ]],
        },
      });
    } catch (err) {
      logger.warn({ err, telegramId: tgId }, '/status failed');
      await ctx.reply('Ошибка при получении статуса.');
    }
  });

  // ── Inline menu actions ──
  bot.action('show_rules', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText(RULES_TEXT, {
      reply_markup: {
        inline_keyboard: [[
          { text: '🧰 Открыть приложение', web_app: { url: env.PUBLIC_WEB_URL } },
        ]],
      },
    });
  });

  bot.action('show_status', async (ctx) => {
    await ctx.answerCbQuery();
    const tgId = ctx.from?.id;
    if (!tgId) return;
    try {
      const text = await getStatusText(tgId);
      await ctx.editMessageText(text, { parse_mode: 'HTML' });
    } catch {
      await ctx.reply('Ошибка при получении статуса.');
    }
  });

  // ── Master moderation ──

  bot.action(/approve_master:(\d+)/, async (ctx) => {
    const telegramId = Number(ctx.match[1]);
    if (!telegramId) return ctx.answerCbQuery('Ошибка');

    try {
      const db = getSupabaseAdmin();
      const { data: profile } = await db
        .from('profiles')
        .select('master_status')
        .eq('telegram_id', telegramId)
        .maybeSingle();

      if (!profile) return ctx.answerCbQuery('Профиль не найден');

      if (profile.master_status !== 'pending') {
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
        return ctx.answerCbQuery('Уже обработано');
      }

      await db
        .from('profiles')
        .update({ is_master: true, master_status: 'approved', current_role: 'master' })
        .eq('telegram_id', telegramId);

      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
      await ctx.answerCbQuery('Заявка одобрена');
      await notifyMasterApproved(telegramId);
    } catch (err) {
      logger.warn({ err }, '[bot] approve error');
      await ctx.answerCbQuery('Ошибка при одобрении');
    }
  });

  bot.action(/reject_master:(\d+)/, async (ctx) => {
    const telegramId = Number(ctx.match[1]);
    if (!telegramId) return ctx.answerCbQuery('Ошибка');

    try {
      const db = getSupabaseAdmin();
      const { data: profile } = await db
        .from('profiles')
        .select('master_status')
        .eq('telegram_id', telegramId)
        .maybeSingle();

      if (!profile) return ctx.answerCbQuery('Профиль не найден');

      if (profile.master_status !== 'pending') {
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
        return ctx.answerCbQuery('Уже обработано');
      }

      await db
        .from('profiles')
        .update({ master_status: 'rejected' })
        .eq('telegram_id', telegramId);

      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
      await ctx.telegram.sendMessage(telegramId,
        '❌ Ваша заявка на статус мастера отклонена.\nСвяжитесь с поддержкой: @masterby_support',
      );
      await ctx.answerCbQuery('Заявка отклонена');
    } catch (err) {
      logger.warn({ err }, '[bot] reject error');
      await ctx.answerCbQuery('Ошибка при отклонении');
    }
  });

  // ── Complaint moderation ──

  bot.action(/block_complaint:([^:]+):(\d+)/, async (ctx) => {
    const complaintId = ctx.match[1];
    const accusedTgId = Number(ctx.match[2]);

    try {
      const db = getSupabaseAdmin();
      await db.from('complaints').update({ status: 'approved' }).eq('id', complaintId);
      if (accusedTgId) {
        await db.from('profiles').update({ master_status: 'blocked' }).eq('telegram_id', accusedTgId);
      }

      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
      await ctx.answerCbQuery('🚫 Пользователь заблокирован');
    } catch (err) {
      logger.warn({ err }, '[bot] block_complaint error');
      await ctx.answerCbQuery('Ошибка');
    }
  });

  bot.action(/dismiss_complaint:([^:]+)/, async (ctx) => {
    const complaintId = ctx.match[1];

    try {
      const db = getSupabaseAdmin();
      await db.from('complaints').update({ status: 'rejected' }).eq('id', complaintId);
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
      await ctx.answerCbQuery('✅ Жалоба отклонена');
    } catch (err) {
      logger.warn({ err }, '[bot] dismiss_complaint error');
      await ctx.answerCbQuery('Ошибка');
    }
  });

  return bot;
}
