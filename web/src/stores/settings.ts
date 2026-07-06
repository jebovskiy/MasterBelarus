import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'system' | 'light' | 'dark';
export type Lang = 'ru' | 'be' | 'en';

export type SettingsState = {
  language: Lang;
  theme: ThemeMode;
  notifyNearby: boolean;
  notifyChat: boolean;
  notifyPromo: boolean;
  setLanguage: (l: Lang) => void;
  setTheme: (t: ThemeMode) => void;
  setNotifyNearby: (v: boolean) => void;
  setNotifyChat: (v: boolean) => void;
  setNotifyPromo: (v: boolean) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'ru',
      theme: 'system',
      notifyNearby: true,
      notifyChat: true,
      notifyPromo: false,
      setLanguage: (language) => set({ language }),
      setTheme: (theme) => set({ theme }),
      setNotifyNearby: (notifyNearby) => set({ notifyNearby }),
      setNotifyChat: (notifyChat) => set({ notifyChat }),
      setNotifyPromo: (notifyPromo) => set({ notifyPromo }),
    }),
    { name: 'mb_settings' },
  ),
);
