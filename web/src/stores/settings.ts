import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Lang = 'ru' | 'be' | 'en';

export type SettingsState = {
  language: Lang;
  notifyNearby: boolean;
  notifyChat: boolean;
  notifyPromo: boolean;
  setLanguage: (l: Lang) => void;
  setNotifyNearby: (v: boolean) => void;
  setNotifyChat: (v: boolean) => void;
  setNotifyPromo: (v: boolean) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'ru',
      notifyNearby: true,
      notifyChat: true,
      notifyPromo: false,
      setLanguage: (language) => set({ language }),
      setNotifyNearby: (notifyNearby) => set({ notifyNearby }),
      setNotifyChat: (notifyChat) => set({ notifyChat }),
      setNotifyPromo: (notifyPromo) => set({ notifyPromo }),
    }),
    { name: 'mb_settings' },
  ),
);
