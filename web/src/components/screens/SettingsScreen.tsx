import { useState, useEffect } from 'react';

const STORAGE_KEY = 'mb_settings';

type Settings = {
  notifyNearby: boolean;
  notifyChat: boolean;
  notifyPromo: boolean;
  language: 'ru' | 'be' | 'en';
  theme: 'system' | 'light' | 'dark';
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Settings;
  } catch { /* noop */ }
  return { notifyNearby: true, notifyChat: true, notifyPromo: false, language: 'ru', theme: 'system' };
}

function saveSettings(s: Settings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* noop */ }
}

type Props = { onBack: () => void };

export default function SettingsScreen({ onBack }: Props) {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  useEffect(() => { saveSettings(settings); }, [settings]);

  const toggle = (key: keyof Settings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const Switch = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button
      onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-slate-800' : 'bg-slate-200'}`}
    >
      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );

  return (
    <div className="min-h-dvh bg-[#f4f4f6] flex flex-col">
      <div className="flex items-center gap-3 px-4 pt-4 pb-2 shrink-0">
        <button onClick={onBack} className="text-slate-600 text-sm font-medium">← Назад</button>
        <h1 className="text-lg font-bold text-slate-900">Настройки</h1>
      </div>

      <div className="flex-1 px-4 space-y-4 overflow-y-auto pb-[calc(16px+env(safe-area-inset-bottom,0px))]">

        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Уведомления</span>
          {[
            { key: 'notifyNearby' as const, label: 'Новые заказы поблизости' },
            { key: 'notifyChat' as const, label: 'Сообщения в чате' },
            { key: 'notifyPromo' as const, label: 'Акции и обновления' },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between py-1">
              <span className="text-sm text-slate-700 font-medium">{label}</span>
              <Switch checked={settings[key]} onChange={() => toggle(key)} />
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Язык приложения</span>
          {([
            { value: 'ru' as const, label: 'Русский' },
            { value: 'be' as const, label: 'Беларуская' },
            { value: 'en' as const, label: 'English' },
          ]).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setSettings((prev) => ({ ...prev, language: value }))}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-[#f4f4f6] hover:scale-[1.02] active:scale-[0.99] transition-transform"
            >
              <span className="text-sm text-slate-700 font-medium">{label}</span>
              {settings.language === value && <span className="text-slate-800 text-lg">✓</span>}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Тема</span>
          <div className="bg-slate-100 rounded-xl p-1 flex w-full">
            {([
              { value: 'system' as const, label: '🖥 Системная' },
              { value: 'light' as const, label: '☀️ Светлая' },
              { value: 'dark' as const, label: '🌙 Тёмная' },
            ]).map(({ value, label }) => {
              const active = settings.theme === value;
              return (
                <button
                  key={value}
                  onClick={() => setSettings((prev) => ({ ...prev, theme: value }))}
                  className={`flex-1 text-center text-xs py-2.5 rounded-lg transition-all ${
                    active ? 'bg-white text-slate-800 font-semibold shadow-sm' : 'text-slate-500 font-medium'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
