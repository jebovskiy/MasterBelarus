import { createServer } from 'node:http';
import type { NextFunction, Request, Response } from 'express';
import * as Sentry from '@sentry/node';
import { env } from './config/env.js';
import { createApp } from './lib/app.js';
import { logger } from './lib/logger.js';
import { authRouter } from './routes/auth.js';
import { createBot } from './bot/index.js';
import { ordersRouter } from './routes/orders.js';
import { bidsRouter } from './routes/bids.js';
import { mastersRouter } from './routes/masters.js';
import { reviewsRouter } from './routes/reviews.js';
import { adminRouter } from './routes/admin.js';
import { complaintsRouter } from './routes/complaints.js';
import { cancelRouter } from './routes/cancel.js';
import { messagesRouter } from './routes/messages.js';
import { readRouter } from './routes/read.js';
import { shutdownAnalytics } from './lib/analytics.js';

async function bootstrap() {
  if (env.SENTRY_DSN) {
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      tracesSampleRate: 0.1,
    });
    logger.info('Sentry initialized');
  } else {
    logger.warn('SENTRY_DSN not set — error monitoring disabled');
  }
  const app = createApp();
  app.use('/auth', authRouter);
  app.use('/orders', ordersRouter);
  app.use('/orders', bidsRouter);
  app.use('/orders', reviewsRouter);
  app.use('/orders', cancelRouter);
  app.use('/orders', messagesRouter);
  app.use('/orders', readRouter);
  app.use('/masters', mastersRouter);
  app.use('/admin', adminRouter);
  app.use('/complaints', complaintsRouter);

const httpServer = createServer(app);
const bot = createBot(env);
const { setBot } = await import('./services/botRegistry.js');
setBot(bot);

const webhookPath = `/telegraf/${env.BOT_TOKEN}`;
  app.use(webhookPath, (req, res, next) => {
    if (req.method !== 'POST') return next();
    if (env.TELEGRAM_SECRET_TOKEN) {
      const secret = req.header('x-telegram-bot-api-secret-token');
      if (secret !== env.TELEGRAM_SECRET_TOKEN) {
        logger.warn({ ip: req.ip }, 'webhook secret mismatch');
        return res.status(401).json({ error: 'invalid secret' });
      }
    }
    bot.webhookCallback()(req as never, res as never, next);
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'not found', path: req.path });
  });

  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    Sentry.withScope((scope) => {
      scope.setSDKProcessingMetadata({ request: req });
      Sentry.captureException(err);
    });
    logger.error({ err }, 'unhandled error');
    res.status(500).json({ error: 'internal' });
  });

  bot.telegram.setWebhook(`${env.PUBLIC_API_URL}${webhookPath}`).catch((err: unknown) => {
    logger.warn({ err }, 'setWebhook failed (will retry on first message)');
  });

  httpServer.listen(env.PORT, () => {
    logger.info({ port: env.PORT, webhookPath }, 'masterby-api listening');
  });

  const shutdown = async () => {
    logger.info('shutting down...');
    await shutdownAnalytics();
    await Sentry.close(2000);
    httpServer.close(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'bootstrap failure');
  process.exit(1);
});
