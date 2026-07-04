import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { logger } from './logger.js';

export function getUserClient(_jwt: string): SupabaseClient {
  return getSupabaseAdmin();
}

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;
  adminClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  logger.info({ url: env.SUPABASE_URL }, 'Supabase admin client initialized');
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
  description: string | null;
  auth_user_id: string | null;
  created_at: string;
};

export type DBOrderStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';
