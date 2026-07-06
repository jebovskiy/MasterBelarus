import { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/components/shared/Toast';
import { Avatar } from '@/components/shared/Avatar';
import CitySelector, { type CityValue } from '@/components/shared/CitySelector';
import { BELARUS_CITIES } from '@/data/belarus-cities';
import { apiPatch, apiUpload, isErrorResult } from '@/lib/api';

type Props = { onBack: () => void };

export default function EditProfileScreen({ onBack }: Props) {
  const { t } = useTranslation();
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const showToast = useToastStore((s) => s.showToast);
  const isMaster = profile?.is_master === true;

  const CATEGORIES = useMemo(() => [
    { key: 'plumber', label: t('home.categories.plumber') },
    { key: 'electrician', label: t('home.categories.electrician') },
    { key: 'mover', label: t('home.categories.mover') },
    { key: 'handyman', label: t('home.categories.handyman') },
    { key: 'tutor', label: t('home.categories.tutor') },
    { key: 'cleaning', label: t('home.categories.cleaning') },
  ], [t]);

  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState(profile?.avatar_url ?? undefined);
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [description, setDescription] = useState(profile?.description ?? '');
  const [categories, setCategories] = useState<string[]>(profile?.categories ?? []);
  const [radiusKm, setRadiusKm] = useState(profile?.radius_km ?? 30);
  const [saving, setSaving] = useState(false);

  const initialCity = useMemo<CityValue | null>(() => {
    if (!profile?.city) return null;
    for (const o of BELARUS_CITIES) {
      const found = o.cities.find((c) => c.name === profile.city);
      if (found) return { city: found.name, oblast: o.name, district: undefined };
    }
    return null;
  }, [profile?.city]);

  const [cityValue, setCityValue] = useState<CityValue | null>(initialCity);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    const result = await apiUpload<{ avatar_url: string }>('/auth/avatar', file);
    setAvatarUploading(false);
    if ('error' in result) {
      showToast(t('toast.photo_error'), 'error');
      return;
    }
    if ('data' in result && result.data) {
      setAvatarSrc(result.data.avatar_url);
      setProfile({ ...profile!, avatar_url: result.data.avatar_url });
      showToast(t('toast.photo_updated'), 'success');
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
      showToast(result.error || t('common.error'), 'error');
      return;
    }
    const updated = result.data as { city?: string | null; radius_km?: number | null; full_name?: string | null; phone?: string | null; avatar_url?: string | null; description?: string | null } | null;
    if (updated) {
      setProfile({ ...profile!, full_name: updated.full_name ?? profile!.full_name, phone: updated.phone ?? profile!.phone, avatar_url: updated.avatar_url ?? profile!.avatar_url, description: updated.description ?? profile!.description, city: updated.city ?? profile!.city, radius_km: updated.radius_km ?? profile!.radius_km, categories });
    }
    showToast(t('toast.profile_saved'), 'success');
    onBack();
  };

  const inputCls = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:border-slate-400 mt-1';
  const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider block';

  return (
    <div className="relative min-h-dvh bg-[#f4f4f6] flex flex-col">
      <div className="flex items-center gap-3 px-4 pt-4 pb-2 shrink-0">
        <button onClick={onBack} className="text-slate-600 text-sm font-medium">{t('common.back')}</button>
        <h1 className="text-lg font-bold text-slate-900">
          {isMaster ? t('profile.edit_profile') : t('profile.edit_title')}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-32 space-y-4">
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
            <span className="text-[11px] text-slate-400">{t('profile.avatar_hint')}</span>
          </div>

          <div>
            <label className={labelCls}>{t('common.name')}</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t('profile.name_placeholder')} className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>{t('common.phone')}</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+375 (29) XXX-XX-XX" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>{t('common.city')}</label>
            <CitySelector value={cityValue} onChange={setCityValue} />
          </div>

          {isMaster && (
            <>
              <div>
                <label className={labelCls}>{t('profile.description_label')}</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
                  placeholder={t('profile.description_placeholder')}
                  rows={4}
                  className={`${inputCls} resize-none`}
                />
                <div className="flex justify-end mt-1">
                  <span className={`text-[11px] ${description.length >= 1000 ? 'text-rose-500 font-semibold' : 'text-slate-400'}`}>{description.length}/1000</span>
                </div>
              </div>

              <div>
                <label className={labelCls}>{t('profile.categories_label')}</label>
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
                <label className={labelCls}>{t('profile.radius_label', { km: radiusKm })}</label>
                <input
                  type="range"
                  min={1}
                  max={200}
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  className="w-full mt-2 accent-slate-800"
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                  <span>{t('master.radius_min')}</span>
                  <span>{t('master.radius_max')}</span>
                </div>
              </div>
            </>
          )}
        </div>

      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#f4f4f6] via-[#f4f4f6]/95 to-transparent pt-8 pb-[calc(16px+env(safe-area-inset-bottom,0px))] px-4">
        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-slate-950 text-white rounded-xl py-4 font-semibold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {saving ? t('orders.saving') : t('common.save')}
        </button>
      </div>
    </div>
  );
}
