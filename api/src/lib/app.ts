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
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:4173',
    'https://masterbelarus-psi.vercel.app',
    'https://t.me',
    ...(env.PUBLIC_WEB_URL ? [env.PUBLIC_WEB_URL] : []),
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

  const pinoMw = pinoHttp as unknown as (opts: Record<string, unknown>) => express.RequestHandler;
  app.use(pinoMw({ logger, transport: undefined, customLogLevel }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'masterby-api', t: Date.now() });
  });

  return app;
}
