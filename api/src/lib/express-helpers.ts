import type { Request } from 'express';
import type { JwtRequest } from '../middleware/jwt.js';

export function telegramIdOrIp(req: Request): string {
  return String((req as JwtRequest).jwtPayload?.telegram_id ?? req.ip);
}
