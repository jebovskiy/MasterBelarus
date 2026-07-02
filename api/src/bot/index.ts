import { Telegraf, type Context } from 'telegraf';
import type { AppEnv } from '../config/env.js';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { initNotificationService, sendBidNotification } from '../services/notifications.js';

export { sendBidNotification };

export function createBot(env: AppEnv): Telegraf<Context> {
  const bot = new Telegraf<Context>(env.BOT_TOKEN);

  initNotificationService(bot);

  bot.start(async (ctx) => {
    await ctx.reply(
      'Добро пожаловать в МастерБай 👋\n' +
        'Открывайте Mini App, чтобы создавать заявки и откликаться на них.',
    );
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(
      'Чтобы вызвать мастера — нажмите «Открыть МастерБай».\n' +
        'Мы пришлём уведомления мастерам поблизоку.',
    );
  });

  bot.action(/approve_master:(\d+)/, async (ctx) => {
    const telegramId = Number(ctx.match[1]);
    if (!telegramId) return ctx.answerCbQuery('Ошибка');

    try {
      const db = getSupabaseAdmin();
      const { error } = await db
        .from('profiles')
        .update({ is_master: true, master_status: 'approved', current_role: 'master' })
        .eq('telegram_id', telegramId);
      if (error) throw error;

      await ctx.editMessageText(
        (ctx.callbackQuery.message as any).text + '\n\n✅ Одобрено',
        { reply_markup: { inline_keyboard: [] } }
      );

      await ctx.telegram.sendMessage(telegramId,
        '✅ Поздравляем! Ваша заявка на статус мастера одобрена.\n' +
        'Откройте Mini App и переключитесь в режим мастера в профиле.'
      );

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
      const { error } = await db
        .from('profiles')
        .update({ master_status: 'rejected' })
        .eq('telegram_id', telegramId);
      if (error) throw error;

      await ctx.editMessageText(
        (ctx.callbackQuery.message as any).text + '\n\n❌ Отклонено',
        { reply_markup: { inline_keyboard: [] } }
      );

      await ctx.telegram.sendMessage(telegramId,
        '❌ К сожалению, ваша заявка на статус мастера отклонена.\n' +
        'Свяжитесь с поддержкой для уточнения причины.'
      );

      await ctx.answerCbQuery('Заявка отклонена');
    } catch (err) {
      console.error('[bot] reject error:', err);
      await ctx.answerCbQuery('Ошибка при отклонении');
    }
  });

  return bot;
}
