import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import ru from './locales/ru.json';
import be from './locales/be.json';
import en from './locales/en.json';

const saved = typeof window !== 'undefined' ? (() => {
  try {
    const raw = localStorage.getItem('mb_settings');
    if (raw) { const p = JSON.parse(raw); return p?.language ?? 'ru'; }
  } catch { /* */ }
  return 'ru';
})() : 'ru';

void i18next.use(initReactI18next).init({
  resources: { ru: { translation: ru }, be: { translation: be }, en: { translation: en } },
  lng: saved,
  fallbackLng: 'ru',
  interpolation: { escapeValue: false },
  returnObjects: true,
});

export default i18next;
