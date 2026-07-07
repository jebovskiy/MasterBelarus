import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useHaptic } from '@/hooks/useHaptic';
import { apiPost, apiUpload } from '@/lib/api';
import { useToastStore } from '@/components/shared/Toast';
import CitySelector, { type CityValue } from '@/components/shared/CitySelector';
import PhotoPicker from '@/components/shared/PhotoPicker';
import { getCityCoords } from '@/data/belarus-cities';
import { sheetTransition } from '@/lib/transitions';

type Props = { open: boolean; onClose: () => void; presetCategory?: string | null };

const CATEGORIES = [
  { key: 'plumber', emoji: '🔧' },
  { key: 'electrician', emoji: '⚡' },
  { key: 'mover', emoji: '📦' },
  { key: 'handyman', emoji: '🛠' },
  { key: 'tutor', emoji: '📚' },
  { key: 'cleaning', emoji: '🧹' },
];

const inputCls = 'w-full bg-[#f4f4f6] text-slate-800 placeholder-slate-400 rounded-xl p-4 border-transparent focus:ring-2 focus:ring-slate-400 focus:bg-white transition-all outline-none text-base';
const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block';

const swipeConfidenceThreshold = 80;
const swipeVelocityThreshold = 400;



export default function CreateOrderSheet({ open, onClose, presetCategory }: Props) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<string>('');

  useEffect(() => {
    if (open && presetCategory) setCategory(presetCategory);
  }, [open, presetCategory]);
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [negotiable, setNegotiable] = useState(false);
  const [cityValue, setCityValue] = useState<CityValue | null>(null);
  const [street, setStreet] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const { impact } = useHaptic();
  const showToast = useToastStore((s) => s.showToast);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const submit = async () => {
    if (!category || !description.trim() || !cityValue) {
      setError(t('orders.fill_required'));
      impact('heavy');
      return;
    }
    setSubmitting(true);
    setError(null);
    impact('medium');

    const addrParts = [`г. ${cityValue.city}`];
    if (cityValue.district) addrParts.push(`${cityValue.district} р-н`);
    if (street.trim()) addrParts.push(street.trim());
    const address_text = addrParts.join(', ');

    const coords = getCityCoords(cityValue.city);

    let images: string[] = [];

    if (photoFiles.length > 0) {
      for (let i = 0; i < photoFiles.length; i++) {
        setUploadProgress(t('orders.uploading_photo', { current: i + 1, total: photoFiles.length }));
        const res = await apiUpload<{ url: string }>('/upload/photo', photoFiles[i]!, 'photo');
        if ('error' in res) {
          setError(t('orders.photo_upload_failed'));
          showToast(t('orders.photo_upload_failed'), 'error');
          setSubmitting(false);
          setUploadProgress(null);
          return;
        }
        images.push(res.data.url);
      }
    }

    setUploadProgress(null);

    const result = await apiPost<{ id: string }>('/orders', {
      category,
      description: description.trim(),
      price: negotiable ? null : Number(price || 0),
      is_negotiable: negotiable,
      address_text,
      lat: coords?.lat,
      lng: coords?.lng,
      images,
    });

    setSubmitting(false);

    if ('error' in result && result.error) {
      setError(result.error);
      showToast(result.error || t('common.error'), 'error');
      return;
    }

    showToast(t('toast.order_created_full'), 'success');
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] flex flex-col justify-end bg-slate-900/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={sheetTransition}>
          <motion.div
            className="relative flex max-h-[90vh] w-full max-w-[430px] mx-auto flex-col rounded-t-[24px] bg-slate-50 shadow-2xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={sheetTransition}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > swipeConfidenceThreshold || info.velocity.y > swipeVelocityThreshold) {
                onClose();
              }
            }}
          >
            <div className="flex flex-col items-center py-3 border-b border-slate-100 bg-white rounded-t-[24px] shrink-0">
              <div className="h-1 w-12 rounded-full bg-slate-300 mb-2" />
              <h3 className="text-base font-semibold text-slate-800">{t('orders.create')}</h3>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pt-5 pb-32 space-y-5">
              <div>
                <label className={labelCls}>{t('orders.category_label')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map((c) => {
                    const active = category === c.key;
                    return (
                      <button
                        key={c.key}
                        onClick={() => { setCategory(c.key); impact('light'); }}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all outline-none ${
                          active
                            ? 'bg-slate-800 text-white shadow-md'
                            : 'bg-[#f4f4f6] text-slate-600 hover:bg-slate-200/50 active:scale-[0.97]'
                        }`}
                      >
                        <span className="text-xl">{c.emoji}</span>
                        <span className="text-xs font-semibold">{t(`home.categories.${c.key}`)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className={labelCls}>{t('orders.description')}</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
                  placeholder={t('orders.description_placeholder')}
                  rows={4}
                  className={`${inputCls} resize-none`}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelCls + ' mb-0'}>{t('orders.budget')}</label>
                  <button
                    onClick={() => { setNegotiable(!negotiable); impact('light'); }}
                    className={`px-3 h-8 rounded-full text-xs font-semibold transition-all ${
                      negotiable ? 'bg-slate-800 text-white' : 'bg-[#f4f4f6] text-slate-500'
                    }`}
                  >
                    {t('master.negotiable')}
                  </button>
                </div>
                {!negotiable && (
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder={t('orders.price_placeholder')}
                    inputMode="numeric"
                    className={inputCls}
                  />
                )}
              </div>

              <div>
                <label className={labelCls}>{t('common.city')}</label>
                <CitySelector value={cityValue} onChange={setCityValue} />
              </div>

              <div>
                <label className={labelCls}>{t('orders.street')}</label>
                <input
                  type="text"
                  value={street}
                  onChange={(e) => setStreet(e.target.value.slice(0, 200))}
                  placeholder={t('orders.street_placeholder')}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>{t('orders.photos')}</label>
                <PhotoPicker files={photoFiles} onChange={setPhotoFiles} max={3} disabled={submitting} />
              </div>

              {error && (
                <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
              )}
            </div>

            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent pt-8 pb-[calc(24px+env(safe-area-inset-bottom,0px))] px-5">
              {uploadProgress && (
                <p className="text-xs text-slate-500 text-center mb-3">{uploadProgress}</p>
              )}
              <button
                onClick={submit}
                disabled={submitting}
                className="w-full bg-slate-900 text-white font-semibold text-base py-4 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md disabled:opacity-50"
              >
                {submitting ? t('orders.publishing') : t('orders.create')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
