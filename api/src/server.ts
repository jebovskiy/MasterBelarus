import { createServer } from 'node:http';
import type { NextFunction, Request, Response } from 'express';
import { env } from './config/env.js';
import { createApp } from './lib/app.js';
import { logger } from './lib/logger.js';
import { authRouter } from './routes/auth.js';
import { createBot, initNotificationService } from './bot/index.js';
import { ordersRouter } from './routes/orders.js';
import { bidsRouter } from './routes/bids.js';
import { mastersRouter } from './routes/masters.js';

async function bootstrap() {
  const app = createApp();
  app.use('/auth', authRouter);
  app.use('/orders', ordersRouter);
  app.use('/orders', bidsRouter);
  app.use('/masters', mastersRouter);

  app.use((req, res) => {
    res.status(404).json({ error: 'not found', path: req.path });
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err }, 'unhandled error');
    res.status(500).json({ error: 'internal' });
  });

  const httpServer = createServer(app);
  const bot = createBot(env);

  initNotificationService(bot);

  const webhookPath = `/telegraf/${env.BOT_TOKEN}`;
  app.use(`/${env.BOT_TOKEN}`, (req, res, next) => {
    if (req.method !== 'POST') return next();
    bot.webhookCallback(webhookPath)(req as never, res as never, next);
  });

  bot.telegram.setWebhook(`${env.PUBLIC_WEB_URL}${webhookPath}`).catch((err: unknown) => {
    logger.warn({ err }, 'setWebhook failed (will retry on first message)');
  });

  httpServer.listen(env.PORT, () => {
    logger.info({ port: env.PORT, webhookPath }, 'masterby-api listening');
  });
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'bootstrap failure');
  process.exit(1);
});
