import { useTranslation } from 'react-i18next';
import { useSettingsStore, type ThemeMode, type Lang } from '@/stores/settings';

type Props = { onBack: () => void };

function Switch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-slate-800 dark:bg-primary' : 'bg-slate-200 dark:bg-slate-600'}`}
    >
      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

export default function SettingsScreen({ onBack }: Props) {
  const { t, i18n } = useTranslation();
  const {
    theme, setTheme,
    notifyNearby, setNotifyNearby,
    notifyChat, setNotifyChat,
    notifyPromo, setNotifyPromo,
  } = useSettingsStore();

  const langs: { value: Lang; label: string }[] = [
    { value: 'ru', label: t('settings.lang_ru') },
    { value: 'be', label: t('settings.lang_be') },
    { value: 'en', label: t('settings.lang_en') },
  ];

  const themes: { value: ThemeMode; label: string }[] = [
    { value: 'system', label: t('settings.theme_system') },
    { value: 'light', label: t('settings.theme_light') },
    { value: 'dark', label: t('settings.theme_dark') },
  ];

  const toggles: { key: string; value: boolean; set: (v: boolean) => void; label: string }[] = [
    { key: 'nearby', value: notifyNearby, set: setNotifyNearby, label: t('settings.notify_nearby') },
    { key: 'chat', value: notifyChat, set: setNotifyChat, label: t('settings.notify_chat') },
    { key: 'promo', value: notifyPromo, set: setNotifyPromo, label: t('settings.notify_promo') },
  ];

  return (
    <div className="min-h-dvh bg-appBg flex flex-col">
      <div className="flex items-center gap-3 px-4 pt-4 pb-2 shrink-0">
        <button onClick={onBack} className="text-textSecondary text-sm font-medium">{t('settings.back')}</button>
        <h1 className="text-lg font-bold text-textMain">{t('settings.title')}</h1>
      </div>

      <div className="flex-1 px-4 space-y-4 overflow-y-auto pb-[calc(16px+env(safe-area-inset-bottom,0px))]">

        <div className="bg-appSurface rounded-2xl p-5 shadow-sm space-y-4">
          <span className="text-xs font-bold text-textMuted uppercase tracking-wider block">{t('settings.notifications')}</span>
          {toggles.map(({ key, value, set, label }) => (
            <div key={key} className="flex items-center justify-between py-1">
              <span className="text-sm text-textMain font-medium">{label}</span>
              <Switch checked={value} onChange={() => set(!value)} />
            </div>
          ))}
        </div>

        <div className="bg-appSurface rounded-2xl p-5 shadow-sm space-y-3">
          <span className="text-xs font-bold text-textMuted uppercase tracking-wider block">{t('settings.language')}</span>
          {langs.map(({ value, label }) => {
            const active = i18n.language === value || i18n.language.startsWith(value);
            return (
              <button
                key={value}
                onClick={() => i18n.changeLanguage(value)}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-appSurfaceAlt hover:scale-[1.02] active:scale-[0.99] transition-transform"
              >
                <span className="text-sm text-textMain font-medium">{label}</span>
                {active && <span className="text-textMain text-lg">✓</span>}
              </button>
            );
          })}
        </div>

        <div className="bg-appSurface rounded-2xl p-5 shadow-sm space-y-3">
          <span className="text-xs font-bold text-textMuted uppercase tracking-wider block">{t('settings.theme')}</span>
          <div className="bg-appSurfaceAlt rounded-xl p-1 flex w-full">
            {themes.map(({ value, label }) => {
              const active = theme === value;
              return (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`flex-1 text-center text-xs py-2.5 rounded-lg transition-all ${
                    active ? 'bg-appSurface text-textMain font-semibold shadow-sm' : 'text-textSecondary font-medium'
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
