import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..', '..');
dotenv.config({ path: path.join(root, '.env') });
dotenv.config({ path: path.join(root, 'api/.env') });
dotenv.config({ path: path.join(root, 'api/.env.local') });

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  PUBLIC_WEB_URL: z.string().trim().url().default('http://localhost:5173'),
  PUBLIC_API_URL: z.string().trim().url().default('http://localhost:3000'),
  BOT_TOKEN: z.string().min(20, 'Telegram bot token is required'),
  TELEGRAM_SECRET_TOKEN: z.string().optional(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  JWT_SECRET: z.string().min(16),
  REDIS_URL: z.string().url().optional(),
  ADMIN_TOKEN: z.string().optional(),
  ADMIN_TELEGRAM_ID: z.coerce.number().optional(),
  MODERATOR_CHAT_ID: z.coerce.number().optional(),
  SENTRY_DSN: z.string().url().optional(),
  POSTHOG_KEY: z.string().optional(),
  POSTHOG_HOST: z.string().url().default('https://app.posthog.com'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type AppEnv = z.infer<typeof EnvSchema>;

let cached: AppEnv | null = null;

export function loadEnv(): AppEnv {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map(i => `${i.path.join('.') || '_'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export const env = new Proxy({} as AppEnv, {
  get(_, key) {
    return loadEnv()[key as keyof AppEnv];
  },
});
