import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/stores/auth';
import { useHaptic } from '@/hooks/useHaptic';
import { Avatar } from '@/components/shared/Avatar';
import { apiPatch, apiPost, isErrorResult } from '@/lib/api';
import { useToastStore } from '@/components/shared/Toast';

const SPECIALTIES = ['Сантехника', 'Электрика', 'Мелкий ремонт'];
const MOCK_MASTER = {
  about: 'Работаю сантехником и электриком более 8 лет. Выезжаю по Минску и области. Гарантия на все виды работ.',
  completed: 142,
  active: 3,
};

function maskPhone(phone?: string | null): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  const last = digits.length >= 2 ? digits.slice(-2) : '**';
  return `+375 (29) ***-**-${last}`;
}

function formatPhone(phone?: string | null): string {
  if (!phone) return '+375 (29) XXX-XX-XX';
  const d = phone.replace(/\D/g, '').slice(-9);
  if (d.length < 9) return '+375 (29) XXX-XX-XX';
  return `+375 (29) ${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5, 7)}`;
}

function formatPhoneInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 9);
  if (!d) return '';
  let out = '+375 (29';
  if (d.length > 2) out += ') ' + d.slice(2);
  if (d.length > 5) out = out.slice(0, -1) + '-' + d.slice(5);
  if (d.length > 7) out = out.slice(0, -1) + '-' + d.slice(7);
  return out;
}

function parsePhone(display: string): string {
  const d = display.replace(/\D/g, '');
  if (d.length === 0) return '';
  return '+' + d;
}

export default function Profile({ onBack, onNavigate }: { onBack?: () => void; onNavigate?: (screen: string) => void }) {
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const clearAuth = useAuthStore((s) => s.clear);
  const showToast = useToastStore((s) => s.showToast);
  const { impact } = useHaptic();
  const name = profile?.full_name ?? profile?.username ?? 'Пользователь';
  const isMasterRole = profile?.is_master === true;
  const currentRole = profile?.current_role ?? 'customer';
  const masterStatus = profile?.master_status ?? 'none';

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(profile?.full_name ?? '');
  const [editPhone, setEditPhone] = useState(formatPhone(profile?.phone));
  const [saving, setSaving] = useState(false);

  const [masterFormOpen, setMasterFormOpen] = useState(false);
  const [mfName, setMfName] = useState(profile?.full_name ?? '');
  const [mfPhone, setMfPhone] = useState(formatPhone(profile?.phone));
  const [mfCity, setMfCity] = useState('');
  const [mfCategory, setMfCategory] = useState('plumber');
  const [mfSaving, setMfSaving] = useState(false);

  const saveEdit = async () => {
    setSaving(true);
    const body: Record<string, unknown> = {};
    if (editName.trim()) body.full_name = editName.trim();
    const phoneRaw = parsePhone(editPhone);
    if (phoneRaw) body.phone = phoneRaw;
    const result = await apiPatch('/auth/profile', body);
    setSaving(false);
    if (isErrorResult(result)) {
      showToast(result.detail ? `${result.error}: ${result.detail}` : result.error, 'error');
      return;
    }
    const updated = result.data as { full_name?: string | null; phone?: string | null } | null;
    if (updated?.full_name !== undefined) profile!.full_name = updated.full_name;
    if (updated?.phone !== undefined) profile!.phone = updated.phone;
    setProfile(profile!);
    setEditing(false);
    showToast('✅ Профиль сохранён', 'success');
  };

  const submitMasterRequest = async () => {
    setMfSaving(true);
    const result = await apiPost('/auth/become-master', {
      full_name: mfName,
      phone: parsePhone(mfPhone),
      city: mfCity,
      category: mfCategory,
    });
    setMfSaving(false);
    if (isErrorResult(result)) {
      const msg = result.detail ? `${result.error}: ${result.detail}` : result.error;
      showToast(msg, 'error');
      return;
    }
    profile!.master_status = 'pending';
    setProfile(profile!);
    setMasterFormOpen(false);
    showToast('✅ Заявка отправлена на модерацию', 'success');
  };

  const switchRole = async () => {
    impact('medium');
    const result = await apiPost<{ current_role: string }>('/auth/switch-role');
    if (isErrorResult(result)) {
      showToast(result.error, 'error');
      return;
    }
    if (result.data) {
      profile!.current_role = result.data.current_role as 'customer' | 'master';
      setProfile(profile!);
    }
  };

  const inputCls = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:border-slate-400';
  const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5';

  return (
    <div className="bg-[#f4f4f6] min-h-screen p-4 space-y-4">
      <div className="flex justify-between items-center px-1">
        <button onClick={onBack} className="text-slate-600 text-sm font-medium">← Назад</button>
        <div className="w-6" />
      </div>

      {isMasterRole && (
        <div className="bg-slate-200/60 rounded-xl p-1 flex w-full">
          <button
            onClick={switchRole}
            className={`flex-1 text-center text-xs py-2.5 rounded-lg transition-all ${
              currentRole === 'customer' ? 'bg-white text-slate-800 font-semibold shadow-sm' : 'text-slate-500 font-medium'
            }`}
          >
            Режим Клиента
          </button>
          <button
            onClick={switchRole}
            className={`flex-1 text-center text-xs py-2.5 rounded-lg transition-all ${
              currentRole === 'master' ? 'bg-white text-slate-800 font-semibold shadow-sm' : 'text-slate-500 font-medium'
            }`}
          >
            Режим Мастера
          </button>
        </div>
      )}

      {currentRole === 'master' ? (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm flex items-center gap-4">
            <Avatar size={48} name={name} src={profile?.avatar_url ?? undefined} />
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-slate-800 truncate">{name}</h2>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-amber-500 text-xs">★</span>
                <span className="text-slate-600 text-xs font-semibold">{profile?.avg_rating?.toFixed(1) ?? '5.0'}</span>
                <span className="text-slate-400 text-xs">• {profile?.review_count ?? 0} отзывов</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {SPECIALTIES.map((s) => (
                  <span key={s} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium">{s}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center gap-2">
            <span className="text-sm">🛡️</span>
            <span className="text-xs font-semibold text-emerald-800">Статус: Проверен (Плательщик НПД)</span>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">О мастере</span>
            <p className="text-sm text-slate-600 leading-relaxed">{MOCK_MASTER.about}</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Статистика</span>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#f4f4f6] rounded-xl p-4 text-center">
                <span className="block text-2xl font-bold text-slate-800">{MOCK_MASTER.completed}</span>
                <span className="text-[11px] text-slate-500">Выполнено</span>
              </div>
              <div className="bg-[#f4f4f6] rounded-xl p-4 text-center">
                <span className="block text-2xl font-bold text-slate-800">{MOCK_MASTER.active}</span>
                <span className="text-[11px] text-slate-500">В работе</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3.5">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Настройки</span>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700">Язык</span>
              <span className="text-sm text-slate-400">Русский</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700">Тема</span>
              <span className="text-sm text-slate-400">Системная</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700">Уведомления</span>
              <span className="text-sm text-slate-400">Вкл</span>
            </div>
          </div>

          <button onClick={() => onNavigate?.('edit_profile')} className="w-full bg-slate-900 text-white rounded-xl py-4 text-center text-sm font-semibold active:scale-[0.99] transition-transform">
            Редактировать анкету мастера
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
                <span className="text-slate-400 text-xs">• Надежный клиент</span>
              </div>
              <p className="text-xs text-slate-500 mt-1 font-mono">{maskPhone(profile?.phone)}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3.5">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Настройки</span>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700">Язык</span>
              <span className="text-sm text-slate-400">Русский</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700">Тема</span>
              <span className="text-sm text-slate-400">Системная</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700">Уведомления</span>
              <span className="text-sm text-slate-400">Вкл</span>
            </div>
          </div>

          {masterStatus === 'none' && (
            <button onClick={() => { impact('light'); setMasterFormOpen(true); }} className="w-full bg-white rounded-2xl p-5 shadow-sm active:scale-[0.99] transition-transform text-left">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-base">🔨</div>
                <div>
                  <span className="text-sm font-semibold text-slate-800">Стать мастером</span>
                  <p className="text-xs text-slate-400 mt-0.5">Принимайте заказы и зарабатывайте</p>
                </div>
              </div>
            </button>
          )}
          {masterStatus === 'pending' && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-1">
              <span className="text-sm font-semibold text-amber-800">⏳ Заявка на модерации</span>
              <p className="text-xs text-amber-600">Ваша заявка рассматривается администратором. Обычно это занимает до 24 часов.</p>
            </div>
          )}
          {masterStatus === 'rejected' && (
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-4">
              <span className="text-sm font-semibold text-rose-800">❌ Заявка отклонена</span>
              <p className="text-xs text-rose-600 mt-1">Свяжитесь с поддержкой для уточнения причины.</p>
            </div>
          )}

          <button onClick={() => { impact('light'); setEditName(profile?.full_name ?? ''); setEditPhone(formatPhone(profile?.phone)); setEditing(true); }} className="w-full bg-slate-900 text-white rounded-xl py-4 text-center text-sm font-semibold active:scale-[0.99] transition-transform">
            Редактировать профиль и телефон
          </button>
        </div>
      )}

      <button onClick={() => { impact('medium'); clearAuth(); }} className="w-full bg-transparent text-rose-500/60 font-medium text-xs py-2 text-center block mt-4 hover:text-rose-600 transition-colors">
        Выйти из аккаунта
      </button>

      <AnimatePresence>
        {editing && (
          <motion.div className="fixed inset-0 z-50 flex items-end justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditing(false)} />
            <motion.div className="relative w-full max-w-[430px] bg-white rounded-t-3xl p-5 pb-8 shadow-modal" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 260 }}>
              <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-300" />
              <h3 className="text-lg font-bold text-slate-900 mb-1">Редактировать профиль</h3>
              <p className="text-sm text-slate-500 mb-5">Имя и телефон будут видны мастерам при отклике</p>
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Имя</label>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Ваше имя" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Телефон</label>
                  <input value={editPhone} onChange={(e) => setEditPhone(formatPhoneInput(e.target.value))} placeholder="+375 (29) XXX-XX-XX" className={inputCls} />
                </div>
              </div>
              <button onClick={saveEdit} disabled={saving} className="w-full bg-slate-950 text-white rounded-xl py-4 font-semibold text-sm mt-6 active:scale-[0.98] transition-all disabled:opacity-60">
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {masterFormOpen && (
          <motion.div className="fixed inset-0 z-50 flex items-end justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMasterFormOpen(false)} />
            <motion.div className="relative w-full max-w-[430px] bg-white rounded-t-3xl p-5 pb-8 shadow-modal" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 260 }}>
              <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-300" />
              <h3 className="text-lg font-bold text-slate-900 mb-1">Стать мастером</h3>
              <p className="text-sm text-slate-500 mb-5">Заполните анкету для модерации</p>
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Имя</label>
                  <input value={mfName} onChange={(e) => setMfName(e.target.value)} placeholder="Иван" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Телефон</label>
                  <input value={mfPhone} onChange={(e) => setMfPhone(formatPhoneInput(e.target.value))} placeholder="+375 (29) XXX-XX-XX" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Город / Район</label>
                  <input value={mfCity} onChange={(e) => setMfCity(e.target.value)} placeholder="Минск" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Специализация</label>
                  <select value={mfCategory} onChange={(e) => setMfCategory(e.target.value)} className={inputCls}>
                    <option value="plumber">Сантехник</option>
                    <option value="electrician">Электрик</option>
                    <option value="mover">Грузчик</option>
                    <option value="handyman">Муж на час</option>
                    <option value="tutor">Репетитор</option>
                    <option value="cleaning">Уборка</option>
                  </select>
                </div>
              </div>
              <button onClick={submitMasterRequest} disabled={mfSaving} className="w-full bg-slate-950 text-white rounded-xl py-4 font-semibold text-sm mt-6 active:scale-[0.98] transition-all disabled:opacity-60">
                {mfSaving ? 'Отправка...' : 'Отправить заявку'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
