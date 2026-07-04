import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { logger } from './logger.js';

const anonUrl = env.SUPABASE_URL;
const anonKey = env.SUPABASE_ANON_KEY;

const clientCache = new Map<string, SupabaseClient>();

export function getUserClient(jwt: string): SupabaseClient {
  const cached = clientCache.get(jwt);
  if (cached) return cached;

  const client = createClient(anonUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  if (clientCache.size > 100) clientCache.clear();
  clientCache.set(jwt, client);
  return client;
}

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;
  adminClient = createClient(anonUrl, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  logger.info({ url: anonUrl }, 'Supabase admin client initialized');
  return adminClient;
}

export type DBProfile = {
  id: string;
  telegram_id: number;
  username: string | null;
  full_name: string | null;
  role: 'client' | 'master';
  is_npd: boolean;
  avatar_url: string | null;
  is_master: boolean;
  current_role: 'customer' | 'master';
  master_status: 'none' | 'pending' | 'approved' | 'rejected' | 'blocked';
  phone: string | null;
  auth_user_id: string | null;
  created_at: string;
};

export type DBOrderStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';
