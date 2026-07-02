import { create } from 'zustand';

const STORAGE_KEY = 'mb_admin_token';

type AdminState = {
  token: string | null;
  isAdmin: boolean;
  setToken: (token: string) => void;
  clear: () => void;
};

export const useAdminStore = create<AdminState>((set) => ({
  token: (() => { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } })(),
  isAdmin: (() => { try { return !!localStorage.getItem(STORAGE_KEY); } catch { return false; } })(),
  setToken: (token) => {
    try { localStorage.setItem(STORAGE_KEY, token); } catch { /* noop */ }
    set({ token, isAdmin: true });
  },
  clear: () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
    set({ token: null, isAdmin: false });
  },
}));

export function adminHeaders(token: string): Record<string, string> {
  return { 'x-admin-token': token };
}
