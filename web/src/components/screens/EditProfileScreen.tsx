import { useState } from 'react';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/components/shared/Toast';
import { apiPatch } from '@/lib/api';

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

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [radiusKm, setRadiusKm] = useState(30);
  const [saving, setSaving] = useState(false);

  const toggleCategory = (key: string) => {
    setCategories((prev) => prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]);
  };

  const save = async () => {
    setSaving(true);
    const body: Record<string, unknown> = {};
    if (fullName.trim()) body.full_name = fullName.trim();
    if (phone.trim()) body.phone = phone.trim();
    if (city.trim()) body.city = city.trim();
    if (isMaster) {
      if (description.trim()) body.description = description.trim();
      if (categories.length > 0) body.categories = categories;
      body.radius_km = radiusKm;
    }
    const result = await apiPatch('/auth/profile', body);
    setSaving(false);
    if ('error' in result) {
      showToast('Ошибка сохранения. Попробуйте снова', 'error');
      return;
    }
    if ('data' in result && result.data) {
      const updated = result.data as { full_name?: string | null; phone?: string | null; city?: string | null };
      if (updated.full_name !== undefined) profile!.full_name = updated.full_name;
      setProfile(profile!);
    }
    showToast('✅ Профиль сохранён', 'success');
    onBack();
  };

  const inputCls = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:border-slate-400 mt-1';
  const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider block';

  return (
    <div className="min-h-screen bg-[#f4f4f6]">
      <div className="px-4 pt-4 space-y-4">
        <div className="flex items-center gap-3 px-1">
          <button onClick={onBack} className="text-slate-600 text-sm font-medium">← Назад</button>
          <h1 className="text-lg font-bold text-slate-900">
            {isMaster ? 'Редактировать анкету' : 'Личные данные'}
          </h1>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
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
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Минск" className={inputCls} />
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

        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-slate-950 text-white rounded-xl py-4 font-semibold text-sm active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {saving ? 'Сохранение...' : 'Сохранить изменения'}
        </button>

        <div className="h-8" />
      </div>
    </div>
  );
}
