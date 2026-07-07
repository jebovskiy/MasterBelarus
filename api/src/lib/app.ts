import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import pinoHttp from 'pino-http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.js';

function customLogLevel(_req: IncomingMessage, res: ServerResponse, err?: unknown): string {
  if (err || res.statusCode >= 500) return 'error';
  if (res.statusCode >= 400) return 'warn';
  return 'info';
}

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  const publicWebUrl = env.PUBLIC_WEB_URL?.replace(/\/+$/, '');
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:4173',
    'https://master-belarus.vercel.app',
    'https://t.me',
    ...(publicWebUrl ? [publicWebUrl] : []),
  ];
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(null, false);
      },
      credentials: false,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '128kb' }));

  app.use((pinoHttp as unknown as (opts: Record<string, unknown>) => express.RequestHandler)({ logger, transport: undefined, customLogLevel }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'masterby-api', t: Date.now() });
  });

  return app;
}
