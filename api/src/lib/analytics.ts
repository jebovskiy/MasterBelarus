import { PostHog } from 'posthog-node';
import { env } from '../config/env.js';
import { logger } from './logger.js';

let client: PostHog | null = null;

export function getPostHog(): PostHog | null {
  if (client) return client;
  if (!env.POSTHOG_KEY) {
    logger.warn('POSTHOG_KEY not set — analytics disabled');
    return null;
  }
  client = new PostHog(env.POSTHOG_KEY, {
    host: env.POSTHOG_HOST,
    flushAt: 20,
    flushInterval: 10000,
  });
  return client;
}

export async function shutdownAnalytics(): Promise<void> {
  if (!client) return;
  await client.shutdown();
  client = null;
}

export function captureEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): void {
  const ph = getPostHog();
  if (!ph) return;
  try {
    ph.capture({ distinctId, event, properties });
  } catch (err) {
    logger.warn({ err, event }, 'analytics capture failed');
  }
}

export function identifyUser(
  distinctId: string,
  traits?: Record<string, unknown>,
): void {
  const ph = getPostHog();
  if (!ph) return;
  try {
    ph.identify({ distinctId, properties: traits ?? {} });
  } catch (err) {
    logger.warn({ err }, 'analytics identify failed');
  }
}
