import { Telegraf, type Context } from 'telegraf';
import type { AppEnv } from '../config/env.js';
import { initNotificationService, sendBidNotification, sendMasterAcceptedNotification } from '../services/notifications.js';

export function createBot(env: AppEnv): Telegraf<Context> {
  const bot = new Telegraf<Context>(env.BOT_TOKEN);

  // Wire notifications: pass the live bot instance so sendMessage actually delivers.
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

  return bot;
}
