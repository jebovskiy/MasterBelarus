import { describe, expect, it } from 'vitest';
import {
  fullNameOf,
  validateTelegramWebAppData,
} from '../src/services/telegram.js';
import crypto from 'node:crypto';

const BOT_TOKEN = 'TEST_BOT_TOKEN_1234567890';

function buildInitData(params: Record<string, string>, botToken = BOT_TOKEN): string {
  const url = new URLSearchParams(params);
  const entries: string[] = [];
  url.forEach((value, key) => {
    if (key !== 'hash') entries.push(`${key}=${value}`);
  });
  entries.sort();
  const dataCheckString = entries.join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  url.set('hash', hash);
  return url.toString();
}

describe('validateTelegramWebAppData', () => {
  it('verifies a correctly signed payload', () => {
    const initData = buildInitData({
      auth_date: String(Math.floor(Date.now() / 1000) - 60),
      user: JSON.stringify({ id: 100, first_name: 'Иван', username: 'ivan' }),
      query_id: 'AAH1mG9L',
    });

    const parsed = validateTelegramWebAppData(initData, BOT_TOKEN);

    expect(parsed.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(parsed.user).toMatchObject({ id: 100, first_name: 'Иван' });
  });

  it('rejects when the signature does not match', () => {
    const initData = buildInitData({ auth_date: String(Math.floor(Date.now() / 1000)) });
    // Templating key would change signature — replay with a wrong token:
    expect(() => validateTelegramWebAppData(initData, 'WRONG_TOKEN')).toThrow();
  });

  it('rejects tampered data', () => {
    const good = buildInitData({ auth_date: String(Math.floor(Date.now() / 1000)) });
    const tampered = good.replace('user=nonexistent', 'user=hacker');
    expect(() => validateTelegramWebAppData(tampered, BOT_TOKEN)).toThrow();
  });

  it('rejects empty initData', () => {
    expect(() => validateTelegramWebAppData('', BOT_TOKEN)).toThrow(/required/);
  });

  it('rejects expired payload (auth_date older than 24h)', () => {
    const oldAuthDate = Math.floor(Date.now() / 1000) - 60 * 60 * 25;
    const initData = buildInitData({ auth_date: String(oldAuthDate) });
    expect(() => validateTelegramWebAppData(initData, BOT_TOKEN)).toThrow(/expired/);
  });
});

describe('fullNameOf', () => {
  it('joins first and last name', () => {
    expect(fullNameOf({ id: 1, first_name: 'Иван', last_name: 'Иванов' })).toBe('Иван Иванов');
  });
  it('falls back to username', () => {
    expect(fullNameOf({ id: 1, username: 'ivan' })).toBe('ivan');
  });
  it('returns null for empty user', () => {
    expect(fullNameOf({ id: 1 })).toBeNull();
  });
});
