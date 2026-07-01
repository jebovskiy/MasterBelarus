import { Telegraf, type Context } from 'telegraf';
import type { AppEnv } from '../config/env.js';

export type MiniAppLaunchData = {
  ref?: string;
};

export function parseStartParam(startParam: string | undefined): MiniAppLaunchData {
  if (!startParam) return {};
  // Format: ref_<telegram_id>  — referrer's telegram_id
  if (startParam.startsWith('ref_')) {
    return { ref: startParam.slice('ref_'.length) };
  }
  return {};
}

export function buildMiniAppButton(env: AppEnv, ref?: string) {
  const startapp = ref ? `ref_${ref}` : 'home';
  return [
    [
      {
        text: 'Открыть МастерБай',
        web_app: { url: `${env.PUBLIC_WEB_URL}/?startapp=${startapp}` },
      },
    ],
  ] as const;
}

export function createBot(env: AppEnv): Telegraf<Context> {
  const bot = new Telegraf<Context>(env.BOT_TOKEN);

  // Telegram sends webhook updates even with secret_token validation. The
  // webhook handler lives in server.ts; here we just register the handlers.
  bot.start(async ctx => {
    const startParam = ctx.startPayload;
    const launch = parseStartParam(startParam);
    await ctx.reply('Добро пожаловать в МастерБай 👋', {
      reply_markup: {
        inline_keyboard: buildMiniAppButton(env, launch.ref) as unknown as never,
      },
    });
  });

  bot.command('help', async ctx => {
    await ctx.reply(
      'Чтобы вызвать мастера — нажмите «Открыть МастерБай».\n' +
        'Мы пришлём уведомления мастерам поблизости.',
    );
  });

  return bot;
}
