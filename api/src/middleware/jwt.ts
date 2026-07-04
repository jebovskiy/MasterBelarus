import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export type JwtPayload = {
  sub: string;
  profile_id: string;
  telegram_id: number;
};

export type JwtRequest = Request & {
  jwtPayload?: JwtPayload;
  jwtToken?: string;
};

const SECRET = env.JWT_SECRET;

export function jwtRequired(req: JwtRequest, res: Response, next: NextFunction) {
  const header = req.header('Authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing Authorization header' });
  }

  const token = header.slice(7);
  req.jwtToken = token;
  try {
    const payload = jwt.verify(token, SECRET) as JwtPayload;
    if (!payload.sub || !payload.profile_id || !payload.telegram_id) {
      return res.status(401).json({ error: 'invalid token payload' });
    }
    req.jwtPayload = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'invalid or expired token' });
  }
}
