import crypto from 'node:crypto';

let _cachedSecretKey: Buffer | null = null;
let _cachedToken: string | null = null;

/**
 * Validates the `initData` string sent from the Mini App frontend against
 * the bot token using HMAC-SHA256. Returns the parsed user object on success.
 *
 * Spec: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export type TelegramWebAppUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
};

export type TelegramWebAppInitData = {
  query_id?: string;
  user?: TelegramWebAppUser;
  receiver?: TelegramWebAppUser;
  chat?: unknown;
  chat_type?: string;
  chat_instance?: string;
  start_param?: string;
  auth_date: number;
  hash: string;
};

export function validateTelegramWebAppData(
  initData: string,
  botToken: string,
): TelegramWebAppInitData {
  if (!initData || typeof initData !== 'string') {
    throw new Error('initData is required');
  }
  if (!botToken) {
    throw new Error('botToken is required');
  }

  const url = new URLSearchParams(initData);
  const hash = url.get('hash');
  if (!hash) throw new Error('hash missing from initData');

  const entries: string[] = [];
  url.forEach((value, key) => {
    if (key !== 'hash') entries.push(`${key}=${value}`);
  });
  entries.sort();
  const dataCheckString = entries.join('\n');

  if (!_cachedSecretKey || _cachedToken !== botToken) {
    _cachedSecretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();
    _cachedToken = botToken;
  }
  const secretKey = _cachedSecretKey;
  const computed = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (
    computed.length !== hash.length ||
    !crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(hash, 'hex'))
  ) {
    throw new Error('invalid initData signature');
  }

  const authDate = Number(url.get('auth_date') ?? '0');
  // Reject data older than 24h to mitigate replay attacks.
  const nowSec = Math.floor(Date.now() / 1000);
  if (authDate && nowSec - authDate > 60 * 60 * 24) {
    throw new Error('initData is expired');
  }

  const userRaw = url.get('user');
  const user = userRaw ? (JSON.parse(userRaw) as TelegramWebAppUser) : undefined;

  return {
    auth_date: authDate,
    hash,
    user,
    start_param: url.get('start_param') ?? undefined,
    chat_instance: url.get('chat_instance') ?? undefined,
    chat_type: url.get('chat_type') ?? undefined,
    query_id: url.get('query_id') ?? undefined,
  };
}

export function fullNameOf(user?: TelegramWebAppUser): string | null {
  if (!user) return null;
  const parts = [user.first_name, user.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : user.username ?? null;
}
