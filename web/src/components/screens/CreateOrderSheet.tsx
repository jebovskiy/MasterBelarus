import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHaptic } from '@/hooks/useHaptic';
import { apiPost } from '@/lib/api';
import { useToast } from '@/components/shared/Toast';

type Props = { open: boolean; onClose: () => void };

const CATEGORIES = [
  { key: 'plumber', label: 'Сантехник', emoji: '🔧' },
  { key: 'electrician', label: 'Электрик', emoji: '⚡' },
  { key: 'mover', label: 'Грузчик', emoji: '📦' },
  { key: 'handyman', label: 'Муж на час', emoji: '🛠' },
  { key: 'tutor', label: 'Репетитор', emoji: '📚' },
  { key: 'cleaning', label: 'Уборка', emoji: '🧹' },
];

const inputCls = 'w-full bg-[#f4f4f6] text-slate-800 placeholder-slate-400 rounded-xl p-4 border-transparent focus:ring-2 focus:ring-slate-400 focus:bg-white transition-all outline-none text-base';
const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block';

const overlayTransition = { duration: 0.2, ease: [0.32, 0.72, 0, 1] };
const sheetTransition = { type: 'spring' as const, damping: 28, stiffness: 240, mass: 0.8 };

export default function CreateOrderSheet({ open, onClose }: Props) {
  const [category, setCategory] = useState<string>('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [negotiable, setNegotiable] = useState(false);
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { impact } = useHaptic();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const submit = async () => {
    if (!category || !description.trim() || !address.trim()) {
      setError('Заполните все обязательные поля');
      impact('heavy');
      return;
    }
    setSubmitting(true);
    setError(null);
    impact('medium');

    const result = await apiPost<{ id: string }>('/orders', {
      category,
      description: description.trim(),
      price: negotiable ? null : Number(price || 0),
      is_negotiable: negotiable,
      address_text: address.trim(),
      images: [],
    });

    setSubmitting(false);

    if ('error' in result && result.error) {
      setError(result.error);
      toast.show('error', 'Ошибка', result.error);
      return;
    }

    toast.show('success', 'Заявка создана!', 'Мастера скоро увидят ваш заказ');
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={overlayTransition}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative w-full max-w-[430px] bg-white rounded-t-2xl shadow-lg shadow-slate-200/50 p-6 max-h-[90vh] overflow-auto will-change-transform"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={sheetTransition}
          >
            <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-slate-300" />
            <h2 className="text-xl font-bold text-slate-800 mb-5">Создать заявку</h2>

            <div className="space-y-5">
              <div>
                <label className={labelCls}>Категория услуг</label>
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
                        <span className="text-xs font-semibold">{c.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className={labelCls}>Описание задачи</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
                  placeholder="Опишите кратко, что случилось и какую работу нужно выполнить..."
                  rows={4}
                  className={`${inputCls} resize-none`}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelCls + ' mb-0'}>Бюджет, BYN</label>
                  <button
                    onClick={() => { setNegotiable(!negotiable); impact('light'); }}
                    className={`px-3 h-8 rounded-full text-xs font-semibold transition-all ${
                      negotiable ? 'bg-slate-800 text-white' : 'bg-[#f4f4f6] text-slate-500'
                    }`}
                  >
                    Договорная
                  </button>
                </div>
                {!negotiable && (
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Сумма в белорусских рублях"
                    inputMode="numeric"
                    className={inputCls}
                  />
                )}
              </div>

              <div>
                <label className={labelCls}>Ваш адрес</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value.slice(0, 200))}
                  placeholder="Минск-Мир, ул. Братская, 1"
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Фото (до 5)</label>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full h-20 rounded-xl border-2 border-dashed border-slate-300 bg-[#f4f4f6] flex items-center justify-center gap-2 text-slate-400 text-sm font-medium hover:border-slate-400 hover:text-slate-500 transition-all"
                >
                  <span className="text-lg">+</span> Прикрепить фото
                </button>
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" />
              </div>

              {error && (
                <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
              )}

              <button
                onClick={submit}
                disabled={submitting}
                className="w-full bg-slate-900 text-white font-semibold text-base py-4 rounded-xl active:scale-[0.98] transition-all shadow-md disabled:opacity-50"
              >
                {submitting ? 'Публикую...' : 'Создать заявку'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
