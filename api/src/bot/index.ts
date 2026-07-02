import { Telegraf, type Context } from 'telegraf';
import type { AppEnv } from '../config/env.js';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { initNotificationService, sendBidNotification, notifyMasterApproved } from '../services/notifications.js';

export { sendBidNotification };

export function createBot(env: AppEnv): Telegraf<Context> {
  const bot = new Telegraf<Context>(env.BOT_TOKEN);

  initNotificationService(bot);

  bot.start(async (ctx) => {
    const payload = ctx.startPayload ?? '';
    let text: string;
    let buttonUrl = env.PUBLIC_WEB_URL;

    if (payload.startsWith('order_')) {
      const orderId = payload.slice(6);
      buttonUrl = `${env.PUBLIC_WEB_URL}?startapp=order_${orderId}`;
      text = '🔍 У вас новый отклик. Нажмите кнопку, чтобы посмотреть.';
    } else if (payload === 'master_feed') {
      buttonUrl = `${env.PUBLIC_WEB_URL}?startapp=master_feed`;
      text = '📋 Вы в режиме мастера. Нажмите кнопку, чтобы открыть ленту заказов.';
    } else {
      text = 'Добро пожаловать в МастерБай!\nСоздавайте заявки и находите мастеров рядом.';
    }

    await ctx.reply(text, {
      reply_markup: {
        inline_keyboard: [[
          { text: 'Открыть МастерБай', web_app: { url: buttonUrl } },
        ]],
      },
    });
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(
      'Чтобы вызвать мастера — нажмите «Открыть МастерБай».\n' +
        'Мы пришлём уведомления мастерам поблизости.',
    );
  });

  bot.action(/approve_master:(\d+)/, async (ctx) => {
    const telegramId = Number(ctx.match[1]);
    if (!telegramId) return ctx.answerCbQuery('Ошибка');

    try {
      const db = getSupabaseAdmin();

      const { data: profile, error: fetchErr } = await db
        .from('profiles')
        .select('master_status')
        .eq('telegram_id', telegramId)
        .maybeSingle();

      if (fetchErr || !profile) return ctx.answerCbQuery('Профиль не найден');

      if (profile.master_status !== 'pending') {
        await ctx.editMessageText(
          (ctx.callbackQuery.message as any).text + '\n\n✅ Уже обработано',
          { reply_markup: { inline_keyboard: [] } },
        );
        return ctx.answerCbQuery('Уже обработано');
      }

      const { error } = await db
        .from('profiles')
        .update({ is_master: true, master_status: 'approved', current_role: 'master' })
        .eq('telegram_id', telegramId);
      if (error) throw error;

      await ctx.editMessageText(
        (ctx.callbackQuery.message as any).text + '\n\n✅ Одобрено',
        { reply_markup: { inline_keyboard: [] } },
      );

      await notifyMasterApproved(telegramId);
      await ctx.answerCbQuery('Заявка одобрена');
    } catch (err) {
      console.error('[bot] approve error:', err);
      await ctx.answerCbQuery('Ошибка при одобрении');
    }
  });

  bot.action(/reject_master:(\d+)/, async (ctx) => {
    const telegramId = Number(ctx.match[1]);
    if (!telegramId) return ctx.answerCbQuery('Ошибка');

    try {
      const db = getSupabaseAdmin();

      const { data: profile, error: fetchErr } = await db
        .from('profiles')
        .select('master_status')
        .eq('telegram_id', telegramId)
        .maybeSingle();

      if (fetchErr || !profile) return ctx.answerCbQuery('Профиль не найден');

      if (profile.master_status !== 'pending') {
        await ctx.editMessageText(
          (ctx.callbackQuery.message as any).text + '\n\n❌ Уже обработано',
          { reply_markup: { inline_keyboard: [] } },
        );
        return ctx.answerCbQuery('Уже обработано');
      }

      const { error } = await db
        .from('profiles')
        .update({ master_status: 'rejected' })
        .eq('telegram_id', telegramId);
      if (error) throw error;

      await ctx.editMessageText(
        (ctx.callbackQuery.message as any).text + '\n\n❌ Отклонено',
        { reply_markup: { inline_keyboard: [] } },
      );

      await ctx.telegram.sendMessage(telegramId,
        '❌ К сожалению, ваша заявка на статус мастера отклонена.\n' +
        'Свяжитесь с поддержкой для уточнения причины.',
      );

      await ctx.answerCbQuery('Заявка отклонена');
    } catch (err) {
      console.error('[bot] reject error:', err);
      await ctx.answerCbQuery('Ошибка при отклонении');
    }
  });

  return bot;
}
