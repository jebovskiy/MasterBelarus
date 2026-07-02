import type { Telegraf, Context } from 'telegraf';

let _bot: Telegraf<Context> | null = null;

export function setBot(bot: Telegraf<Context>): void {
  _bot = bot;
}

export function getBot(): Telegraf<Context> {
  if (!_bot) throw new Error('bot not initialized');
  return _bot;
}
