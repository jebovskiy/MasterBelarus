import { useState, useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/stores/auth';
import { useSettingsStore } from '@/stores/settings';
import { useHaptic } from '@/hooks/useHaptic';
import { Avatar } from '@/components/shared/Avatar';
import CitySelector, { type CityValue } from '@/components/shared/CitySelector';
import { apiPatch, apiPost, isErrorResult } from '@/lib/api';
import { useToastStore } from '@/components/shared/Toast';
import { getTelegramInitData } from '@/lib/telegram';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const SPECIALTIES = ['Сантехника', 'Электрика', 'Мелкий ремонт'];

const MOCK_MASTER = {
  about: 'Работаю сантехником и электриком более 8 лет. Выезжаю по Минску и области. Гарантия на все виды работ.',
  completed: 142,
  active: 3,
};

function maskPhone(phone?: string | null): string {
  if (!phone) return '+375 (XX) XXX-XX-XX';
  const d = phone.replace(/\D/g, '');
  if (d.length < 7) return phone;
  const last2 = d.slice(-2);
  const code = d.slice(0, 3);
  const op = d.slice(3, 5);
  return `+${code} (${op}) ***-**-${last2}`;
}

function formatPhone(phone?: string | null): string {
  if (!phone) return '';
  const d = phone.replace(/\D/g, '');
  if (d.length < 7) return phone;
  const code = d.slice(0, 3);
  const op = d.slice(3, 5);
  const rest = d.slice(5);
  if (rest.length === 7) {
    return `+${code} (${op}) ${rest.slice(0, 3)}-${rest.slice(3, 5)}-${rest.slice(5)}`;
  }
  return `+${code} (${op}) ${rest}`;
}

function formatPhoneInput(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.length === 0) return '';
  if (d.length <= 3) return '+' + d;
  if (d.length <= 5) return `+${d.slice(0, 3)} (${d.slice(3)}`;
  if (d.length <= 8) return `+${d.slice(0, 3)} (${d.slice(3, 5)}) ${d.slice(5)}`;
  if (d.length <= 10) return `+${d.slice(0, 3)} (${d.slice(3, 5)}) ${d.slice(5, 8)}-${d.slice(8)}`;
  return `+${d.slice(0, 3)} (${d.slice(3, 5)}) ${d.slice(5, 8)}-${d.slice(8, 10)}-${d.slice(10, 12)}`;
}

function parsePhone(display: string): string {
  const d = display.replace(/\D/g, '');
  return d ? '+' + d : '';
}

function SettingsCard({ onNavigate }: { onNavigate?: (s: string) => void }) {
  const { t } = useTranslation();
  const { language, notifyNearby } = useSettingsStore();
  const anyNotifOn = notifyNearby;
  return (
    <button onClick={() => onNavigate?.('settings')} className="w-full bg-white rounded-2xl p-5 shadow-sm space-y-3.5 active:scale-[0.98] transition-transform text-left">
      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">{t('profile.settings')}</span>
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-700">{t('profile.language')}</span>
        <span className="text-sm text-slate-400">{t(`profile.lang_${language}`)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-700">{t('profile.notifications')}</span>
        <span className="text-sm text-slate-400">{anyNotifOn ? t('profile.notif_on') : t('profile.notif_off')}</span>
      </div>
    </button>
  );
}

function ProfileBottomSheet({ open, onClose, title, desc, children, loading }: {
  open: boolean;
  onClose: () => void;
  title: string;
  desc: string;
  children: ReactNode;
  loading?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] flex items-end justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/40 " onClick={onClose} />
          <motion.div
            className="relative w-full max-w-[430px] bg-white rounded-t-3xl shadow-modal flex flex-col"
            style={{ maxHeight: '80dvh' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className="shrink-0 mx-auto mt-3 mb-2 h-1.5 w-10 rounded-full bg-slate-300" />
            <div className="shrink-0 px-5">
              <h3 className="text-lg font-bold text-slate-900 mb-1">{title}</h3>
              <p className="text-sm text-slate-500 mb-4">{desc}</p>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
              {children}
            </div>
            <div className="shrink-0 px-5 pb-[calc(32px+env(safe-area-inset-bottom,0px))] pt-3">
              <div className="h-px bg-slate-100 -mx-5 mb-4" />
              <button
                type="submit"
                form="bottom-sheet-form"
                disabled={loading}
                className="w-full bg-slate-950 text-white rounded-xl py-4 font-semibold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {loading ? t('orders.saving') : t('common.save')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function Profile({ onBack, onNavigate }: { onBack?: () => void; onNavigate?: (screen: string) => void }) {
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const clearAuth = useAuthStore((s) => s.clear);
  const showToast = useToastStore((s) => s.showToast);
  const { impact } = useHaptic();
  const { t } = useTranslation();
  const name = profile?.full_name ?? profile?.username ?? 'Пользователь';
  const isMasterRole = profile?.is_master === true;
  const currentRole = profile?.current_role ?? 'customer';
  const masterStatus = profile?.master_status ?? 'none';

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [masterFormOpen, setMasterFormOpen] = useState(false);
  const [mfName, setMfName] = useState('');
  const [mfPhone, setMfPhone] = useState('');
  const [mfCityValue, setMfCityValue] = useState<CityValue | null>(null);
  const [mfCategory, setMfCategory] = useState('plumber');
  const [savingMaster, setSavingMaster] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [isSwitchingRole, setIsSwitchingRole] = useState(false);

  useEffect(() => {
    const initData = getTelegramInitData();
    if (!initData) return;
    fetch(`${API_BASE}/admin/self`, { headers: { 'x-telegram-init-data': initData } })
      .then((r) => { if (r.ok) setIsAdminUser(true); })
      .catch(() => {});
  }, []);

  const inputCls = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all';
  const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5';

  function openEdit() {
    impact('light');
    setEditName(profile?.full_name ?? '');
    setEditPhone(formatPhone(profile?.phone));
    setEditing(true);
  }

  const saveEdit = async () => {
    setSavingEdit(true);
    const body: Record<string, unknown> = {};
    if (editName.trim()) body.full_name = editName.trim();
    const phoneRaw = parsePhone(editPhone);
    if (phoneRaw) body.phone = phoneRaw;
    const result = await apiPatch('/auth/profile', body);
    setSavingEdit(false);
    if (isErrorResult(result)) {
      showToast(result.error || t('common.error'), 'error');
      return;
    }
    const updated = result.data as { full_name?: string | null; phone?: string | null } | null;
    if (updated) {
      setProfile({ ...profile!, ...updated });
    }
    setEditing(false);
    showToast(t('toast.profile_saved'), 'success');
  };

  const submitMasterRequest = async () => {
    setSavingMaster(true);
    const result = await apiPost('/auth/become-master', {
      full_name: mfName,
      phone: parsePhone(mfPhone),
      city: mfCityValue?.city ?? '',
      category: mfCategory,
    });
    setSavingMaster(false);
    if (isErrorResult(result)) {
      showToast(result.error || t('common.error'), 'error');
      return;
    }
    setProfile({ ...profile!, master_status: 'pending' });
    setMasterFormOpen(false);
    showToast(t('profile.pending_moderation'), 'success');
  };

  const switchRole = async () => {
    impact('medium');
    if (isSwitchingRole) return;
    const next = profile!.current_role === 'master' ? 'customer' : 'master';
    setIsSwitchingRole(true);
    const result = await apiPost<{ current_role: string }>('/auth/switch-role');
    setIsSwitchingRole(false);
    if (isErrorResult(result)) {
      showToast(result.error, 'error');
      return;
    }
    setProfile({ ...profile!, current_role: next });
  };

  return (
    <div className="bg-[#f4f4f6] min-h-screen p-4 space-y-4 pb-8">
      <div className="flex justify-between items-center px-1">
        <button onClick={onBack} className="text-slate-600 text-sm font-medium">{t('common.back')}</button>
        <div className="w-6" />
      </div>

      {isMasterRole && (
        <div className="bg-slate-200/60 rounded-xl p-1 flex w-full">
          <button
            onClick={switchRole}
            disabled={isSwitchingRole}
            className={`flex-1 text-center text-xs py-2.5 rounded-lg transition-all ${
              currentRole === 'customer' ? 'bg-white text-slate-800 font-semibold shadow-sm' : 'text-slate-500 font-medium'
            } ${isSwitchingRole ? 'opacity-50' : ''}`}
          >
            {isSwitchingRole ? '⟳' : 'Режим Клиента'}
          </button>
          <button
            onClick={switchRole}
            disabled={isSwitchingRole}
            className={`flex-1 text-center text-xs py-2.5 rounded-lg transition-all ${
              currentRole === 'master' ? 'bg-white text-slate-800 font-semibold shadow-sm' : 'text-slate-500 font-medium'
            } ${isSwitchingRole ? 'opacity-50' : ''}`}
          >
            {isSwitchingRole ? '⟳' : 'Режим Мастера'}
          </button>
        </div>
      )}

      {currentRole === 'master' ? (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <Avatar size={48} name={name} src={profile?.avatar_url ?? undefined} />
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-slate-800 truncate">{name}</h2>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-amber-500 text-xs">★</span>
                  <span className="text-slate-600 text-xs font-semibold">{profile?.avg_rating?.toFixed(1) ?? '5.0'}</span>
                  <span className="text-slate-400 text-xs">• {profile?.review_count ?? 0} {t('profile.reviews')}</span>
                </div>
                {profile?.city && (
                  <p className="text-[11px] text-slate-400 mt-1">{profile.city}</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {(profile?.categories ?? []).map((cat) => {
                const label = t(`home.categories.${cat}`, cat);
                return <span key={cat} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium">{label}</span>;
              })}
              {(profile?.categories ?? []).length === 0 && SPECIALTIES.map((s) => (
                <span key={s} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium">{s}</span>
              ))}
            </div>
          </div>

          {masterStatus === 'approved' ? (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center gap-2">
              <span className="text-sm">✅</span>
              <span className="text-xs font-semibold text-emerald-800">{t('profile.verified')}</span>
            </div>
          ) : masterStatus === 'pending' ? (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-center gap-2">
              <span className="text-sm">⏳</span>
              <span className="text-xs font-semibold text-amber-800">{t('profile.moderation')}</span>
            </div>
          ) : masterStatus === 'rejected' ? (
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 flex items-center gap-2">
              <span className="text-sm">❌</span>
              <span className="text-xs font-semibold text-rose-800">{t('profile.rejected')}</span>
            </div>
          ) : masterStatus === 'blocked' ? (
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 flex items-center gap-2">
              <span className="text-sm">🚫</span>
              <span className="text-xs font-semibold text-rose-800">{t('profile.blocked')}</span>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-2">
              <span className="text-sm">🛡️</span>
              <span className="text-xs font-semibold text-slate-600">{t('profile.not_verified')}</span>
            </div>
          )}

          {masterStatus !== 'approved' && masterStatus !== 'blocked' && (
            <button onClick={() => { impact('light'); showToast(t('profile.verify_unavailable'), 'info'); }} className="w-full bg-white rounded-2xl p-5 shadow-sm active:scale-[0.98] transition-transform text-left">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-base">✅</div>
                <div>
                  <span className="text-sm font-semibold text-slate-800">{t('profile.verify_cta')}</span>
                  <p className="text-xs text-slate-400 mt-0.5">{t('profile.verify_cta_desc')}</p>
                </div>
              </div>
            </button>
          )}

          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">{t('profile.about_master')}</span>
            {profile?.description ? (
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{profile.description}</p>
            ) : (
              <p className="text-sm text-slate-400 italic">{t('profile.no_description')}</p>
            )}
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">{t('profile.stats')}</span>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#f4f4f6] rounded-xl p-4 text-center">
                <span className="block text-2xl font-bold text-slate-800">{MOCK_MASTER.completed}</span>
                <span className="text-[11px] text-slate-500">{t('profile.completed')}</span>
              </div>
              <div className="bg-[#f4f4f6] rounded-xl p-4 text-center">
                <span className="block text-2xl font-bold text-slate-800">{MOCK_MASTER.active}</span>
                <span className="text-[11px] text-slate-500">{t('profile.in_work')}</span>
              </div>
            </div>
          </div>

          <SettingsCard onNavigate={onNavigate} />

          <button onClick={() => onNavigate?.('edit_profile')} className="w-full bg-slate-900 text-white rounded-xl py-4 text-center text-sm font-semibold active:scale-[0.98] transition-transform">
            {t('profile.edit_profile')}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm flex items-center gap-4">
            <Avatar size={48} name={name} src={profile?.avatar_url ?? undefined} />
            <div>
              <h2 className="text-lg font-bold text-slate-800">{name}</h2>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-amber-500 text-xs">★</span>
                <span className="text-slate-600 text-xs font-semibold">5.0</span>
                <span className="text-slate-400 text-xs">• {t('profile.reliable_client')}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1 font-mono">{maskPhone(profile?.phone)}</p>
            </div>
          </div>

          <SettingsCard onNavigate={onNavigate} />

          {isAdminUser && (
            <button onClick={() => onNavigate?.('admin')} className="w-full bg-slate-900 text-white rounded-xl py-4 text-center text-sm font-semibold active:scale-[0.98] transition-transform">
              {t('profile.admin')}
            </button>
          )}

          {masterStatus === 'none' && (
            <button onClick={() => { impact('light'); setMfName(profile?.full_name ?? ''); setMfPhone(formatPhone(profile?.phone)); setMasterFormOpen(true); }} className="w-full bg-white rounded-2xl p-5 shadow-sm active:scale-[0.98] transition-transform text-left">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-base">🔨</div>
                <div>
                  <span className="text-sm font-semibold text-slate-800">{t('profile.become_master')}</span>
                  <p className="text-xs text-slate-400 mt-0.5">{t('profile.become_master_desc')}</p>
                </div>
              </div>
            </button>
          )}
          {masterStatus === 'pending' && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-1">
              <span className="text-sm font-semibold text-amber-800">⏳ {t('profile.pending_moderation')}</span>
              <p className="text-xs text-amber-600">Ваша заявка рассматривается администратором. Обычно это занимает до 24 часов.</p>
            </div>
          )}
          {masterStatus === 'rejected' && (
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-4">
              <span className="text-sm font-semibold text-rose-800">❌ {t('profile.rejected')}</span>
              <p className="text-xs text-rose-600 mt-1">Свяжитесь с поддержкой для уточнения причины.</p>
            </div>
          )}

          <button onClick={openEdit} className="w-full bg-slate-900 text-white rounded-xl py-4 text-center text-sm font-semibold active:scale-[0.98] transition-transform">
            Редактировать профиль и телефон
          </button>
        </div>
      )}

      <button onClick={() => { impact('medium'); clearAuth(); }} className="w-full bg-transparent text-rose-500/60 font-medium text-xs py-2 text-center block mt-4 hover:text-rose-600 transition-colors">
        Выйти из аккаунта
      </button>

      <ProfileBottomSheet open={editing} onClose={() => setEditing(false)} title="Редактировать профиль" desc="Имя и телефон будут видны мастерам при отклике" loading={savingEdit}>
        <form id="bottom-sheet-form" onSubmit={(e) => { e.preventDefault(); saveEdit(); }}>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>{t('common.name')}</label>
              <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Ваше имя" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t('common.phone')}</label>
              <input
                value={editPhone}
                onChange={(e) => setEditPhone(formatPhoneInput(e.target.value))}
                placeholder="+375 (29) XXX-XX-XX"
                inputMode="numeric"
                className={`${inputCls} tracking-wider`}
              />
              <p className="text-[11px] text-slate-400 mt-1.5">Введите цифры номера, начиная с 375 (код Беларуси)</p>
            </div>
          </div>
        </form>
      </ProfileBottomSheet>

      <ProfileBottomSheet open={masterFormOpen} onClose={() => setMasterFormOpen(false)} title={t('profile.become_master')} desc="Заполните анкету для модерации" loading={savingMaster}>
        <form id="bottom-sheet-form" onSubmit={(e) => { e.preventDefault(); submitMasterRequest(); }}>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>{t('common.name')}</label>
              <input value={mfName} onChange={(e) => setMfName(e.target.value)} placeholder="Иван" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t('common.phone')}</label>
              <input
                value={mfPhone}
                onChange={(e) => setMfPhone(formatPhoneInput(e.target.value))}
                placeholder="+375 (29) XXX-XX-XX"
                inputMode="numeric"
                className={`${inputCls} tracking-wider`}
              />
              <p className="text-[11px] text-slate-400 mt-1.5">Введите цифры номера, начиная с 375 (код Беларуси)</p>
            </div>
            <div>
              <label className={labelCls}>{t('common.city')}</label>
              <CitySelector value={mfCityValue} onChange={setMfCityValue} />
            </div>
            <div>
              <label className={labelCls}>{t('orders.category')}</label>
              <select value={mfCategory} onChange={(e) => setMfCategory(e.target.value)} className={inputCls}>
                <option value="plumber">{t('home.categories.plumber')}</option>
                <option value="electrician">{t('home.categories.electrician')}</option>
                <option value="mover">{t('home.categories.mover')}</option>
                <option value="handyman">{t('home.categories.handyman')}</option>
                <option value="tutor">{t('home.categories.tutor')}</option>
                <option value="cleaning">{t('home.categories.cleaning')}</option>
              </select>
            </div>
          </div>
        </form>
      </ProfileBottomSheet>
    </div>
  );
}
