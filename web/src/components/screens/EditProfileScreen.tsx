import { useRef, useState } from 'react';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/components/shared/Toast';
import { Avatar } from '@/components/shared/Avatar';
import CitySelector, { type CityValue } from '@/components/shared/CitySelector';
import { apiPatch, apiUpload, isErrorResult } from '@/lib/api';

const CATEGORIES = [
  { key: 'plumber', label: 'Сантехник' },
  { key: 'electrician', label: 'Электрик' },
  { key: 'mover', label: 'Грузчик' },
  { key: 'handyman', label: 'Муж на час' },
  { key: 'tutor', label: 'Репетитор' },
  { key: 'cleaning', label: 'Уборка' },
];

type Props = { onBack: () => void };

export default function EditProfileScreen({ onBack }: Props) {
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const showToast = useToastStore((s) => s.showToast);
  const isMaster = profile?.role === 'master';

  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState(profile?.avatar_url ?? undefined);
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [cityValue, setCityValue] = useState<CityValue | null>(null);
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [radiusKm, setRadiusKm] = useState(30);
  const [saving, setSaving] = useState(false);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    const result = await apiUpload<{ avatar_url: string }>('/auth/avatar', file);
    setAvatarUploading(false);
    if ('error' in result) {
      showToast('Ошибка загрузки фото', 'error');
      return;
    }
    if ('data' in result && result.data) {
      setAvatarSrc(result.data.avatar_url);
      profile!.avatar_url = result.data.avatar_url;
      setProfile(profile!);
      showToast('Фото обновлено', 'success');
    }
  };

  const toggleCategory = (key: string) => {
    setCategories((prev) => prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]);
  };

  const save = async () => {
    setSaving(true);
    const body: Record<string, unknown> = {};
    if (fullName.trim()) body.full_name = fullName.trim();
    if (phone.trim()) body.phone = phone.trim();
    if (cityValue?.city) body.city = cityValue.city;
    if (isMaster) {
      if (description.trim()) body.description = description.trim();
      if (categories.length > 0) body.categories = categories;
      body.radius_km = radiusKm;
    }
    const result = await apiPatch('/auth/profile', body);
    setSaving(false);
    if (isErrorResult(result)) {
      const msg = result.detail ? `${result.error}: ${result.detail}` : result.error;
      showToast(msg, 'error');
      return;
    }
    const updated = result.data as { full_name?: string | null; phone?: string | null; city?: string | null } | null;
    if (updated?.full_name !== undefined) profile!.full_name = updated.full_name;
    setProfile(profile!);
    showToast('✅ Профиль сохранён', 'success');
    onBack();
  };

  const inputCls = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:border-slate-400 mt-1';
  const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider block';

  return (
    <div className="min-h-dvh bg-[#f4f4f6] flex flex-col">
      <div className="flex items-center gap-3 px-4 pt-4 pb-2 shrink-0">
        <button onClick={onBack} className="text-slate-600 text-sm font-medium">← Назад</button>
        <h1 className="text-lg font-bold text-slate-900">
          {isMaster ? 'Редактировать анкету' : 'Личные данные'}
        </h1>
      </div>

      <div className="flex-1 px-4 space-y-4 overflow-y-auto">
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col items-center gap-2 pb-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={avatarUploading}
              className="relative active:scale-95 transition-transform"
            >
              <Avatar size={64} name={fullName || profile?.full_name || '?'} src={avatarSrc} />
              <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <span className="text-white text-[10px] font-bold">{avatarUploading ? '...' : '📷'}</span>
              </div>
            </button>
            <span className="text-[11px] text-slate-400">Нажмите, чтобы изменить фото</span>
          </div>

          <div>
            <label className={labelCls}>Имя</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ваше имя" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Телефон</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+375 (29) XXX-XX-XX" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Город</label>
            <CitySelector value={cityValue} onChange={setCityValue} />
          </div>

          {isMaster && (
            <>
              <div>
                <label className={labelCls}>Описание услуг</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
                  placeholder="Расскажите о своём опыте, специализации и условиях работы..."
                  rows={4}
                  className={`${inputCls} resize-none`}
                />
              </div>

              <div>
                <label className={labelCls}>Категории работ</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {CATEGORIES.map((cat) => {
                    const active = categories.includes(cat.key);
                    return (
                      <button
                        key={cat.key}
                        onClick={() => toggleCategory(cat.key)}
                        className={`p-3 rounded-xl text-xs font-semibold transition-all ${
                          active ? 'bg-slate-800 text-white' : 'bg-[#f4f4f6] text-slate-600'
                        }`}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className={labelCls}>Радиус выезда: {radiusKm} км</label>
                <input
                  type="range"
                  min={1}
                  max={200}
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  className="w-full mt-2 accent-slate-800"
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                  <span>1 км</span>
                  <span>200 км</span>
                </div>
              </div>
            </>
          )}
        </div>

      </div>

      <div className="px-4 pt-3 pb-[calc(16px+env(safe-area-inset-bottom,0px))] shrink-0">
        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-slate-950 text-white rounded-xl py-4 font-semibold text-sm active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {saving ? 'Сохранение...' : 'Сохранить изменения'}
        </button>
      </div>
    </div>
  );
}
