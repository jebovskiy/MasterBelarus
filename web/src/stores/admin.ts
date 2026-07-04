import { create } from 'zustand';
import { getTelegramInitData } from '@/lib/telegram';

type AdminState = {
  isAdmin: boolean;
  checking: boolean;
  setTelegramAdmin: () => void;
  clear: () => void;
  setChecking: (v: boolean) => void;
};

export const useAdminStore = create<AdminState>((set) => ({
  isAdmin: false,
  checking: true,
  setTelegramAdmin: () => {
    set({ isAdmin: true, checking: false });
  },
  clear: () => {
    set({ isAdmin: false, checking: false });
  },
  setChecking: (v) => set({ checking: v }),
}));

export function adminHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const initData = getTelegramInitData();
  if (initData) headers['x-telegram-init-data'] = initData;
  return headers;
}
