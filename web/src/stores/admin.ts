import { create } from 'zustand';
import { getTelegramInitData } from '@/lib/telegram';

const STORAGE_KEY = 'mb_admin_token';

type AdminState = {
  token: string | null;
  isAdmin: boolean;
  setToken: (token: string) => void;
  setTelegramAdmin: () => void;
  clear: () => void;
};

export const useAdminStore = create<AdminState>((set) => ({
  token: (() => { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } })(),
  isAdmin: (() => { try { return !!localStorage.getItem(STORAGE_KEY); } catch { return false; } })(),
  setToken: (token) => {
    try { localStorage.setItem(STORAGE_KEY, token); } catch { /* noop */ }
    set({ token, isAdmin: true });
  },
  setTelegramAdmin: () => {
    set({ token: null, isAdmin: true });
  },
  clear: () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
    set({ token: null, isAdmin: false });
  },
}));

export function adminHeaders(token: string | null): Record<string, string> {
  const headers: Record<string, string> = {};
  if (token) headers['x-admin-token'] = token;
  const initData = getTelegramInitData();
  if (initData) headers['x-telegram-init-data'] = initData;
  return headers;
}
