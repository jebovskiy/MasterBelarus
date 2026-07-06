import { useTranslation } from 'react-i18next';
import { useSettingsStore, type Lang } from '@/stores/settings';

type Props = { onBack: () => void };

function Switch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-slate-800' : 'bg-slate-200'}`}
    >
      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

export default function SettingsScreen({ onBack }: Props) {
  const { t, i18n } = useTranslation();
  const {
    setLanguage,
    notifyNearby, setNotifyNearby,
    notifyChat, setNotifyChat,
    notifyPromo, setNotifyPromo,
  } = useSettingsStore();

  const langs: { value: Lang; label: string }[] = [
    { value: 'ru', label: t('settings.lang_ru') },
    { value: 'be', label: t('settings.lang_be') },
    { value: 'en', label: t('settings.lang_en') },
  ];

  const toggles: { key: string; value: boolean; set: (v: boolean) => void; label: string }[] = [
    { key: 'nearby', value: notifyNearby, set: setNotifyNearby, label: t('settings.notify_nearby') },
    { key: 'chat', value: notifyChat, set: setNotifyChat, label: t('settings.notify_chat') },
    { key: 'promo', value: notifyPromo, set: setNotifyPromo, label: t('settings.notify_promo') },
  ];

  return (
    <div className="min-h-dvh bg-[#f4f4f6] flex flex-col">
      <div className="flex items-center gap-3 px-4 pt-4 pb-2 shrink-0">
        <button onClick={onBack} className="text-slate-600 text-sm font-medium">{t('settings.back')}</button>
        <h1 className="text-lg font-bold text-slate-900">{t('settings.title')}</h1>
      </div>

      <div className="flex-1 px-4 space-y-4 overflow-y-auto pb-[calc(16px+env(safe-area-inset-bottom,0px))]">

        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">{t('settings.notifications')}</span>
          {toggles.map(({ key, value, set, label }) => (
            <div key={key} className="flex items-center justify-between py-1">
              <span className="text-sm text-slate-700 font-medium">{label}</span>
              <Switch checked={value} onChange={() => set(!value)} />
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">{t('settings.language')}</span>
          {langs.map(({ value, label }) => {
            const active = i18n.language === value || i18n.language.startsWith(value);
            return (
              <button
                key={value}
                onClick={() => { setLanguage(value); i18n.changeLanguage(value); }}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-[#f4f4f6] hover:scale-[1.02] active:scale-[0.99] transition-transform"
              >
                <span className="text-sm text-slate-700 font-medium">{label}</span>
                {active && <span className="text-slate-800 text-lg">✓</span>}
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
}
