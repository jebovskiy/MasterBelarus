import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHaptic } from '@/hooks/useHaptic';
import { apiPost } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

type Props = { open: boolean; onClose: () => void };

const CATEGORIES = [
  { key: 'plumber', label: 'Сантехник', emoji: '🔧' },
  { key: 'electrician', label: 'Электрик', emoji: '⚡' },
  { key: 'mover', label: 'Грузчик', emoji: '📦' },
  { key: 'handyman', label: 'Муж на час', emoji: '🛠' },
  { key: 'tutor', label: 'Репетитор', emoji: '📚' },
  { key: 'cleaning', label: 'Уборка', emoji: '🧹' },
];

export default function CreateOrderSheet({ open, onClose }: Props) {
  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [negotiable, setNegotiable] = useState(false);
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { impact, notification } = useHaptic();
  const profile = useAuthStore((s) => s.profile);
  const fileRef = useRef<HTMLInputElement>(null);

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

    if ('error' in result) {
      setError(result.error);
      notification('error');
      return;
    }

    notification('success');
    onClose();
    // TODO: navigate to order detail (Sprint 2 front routing)
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

          <motion.div
            className="relative w-full max-w-[430px] bg-app-surface rounded-t-3xl p-5 pb-8 shadow-modal"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-app-border" />

            <h2 className="text-xl font-bold text-text-main mb-4">Опишите задачу</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text-main mb-2">Категория *</label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => {
                        setCategory(c.key);
                        impact('light');
                      }}
                      className={`flex flex-col items-center gap-1 p-3 rounded-bento border transition-all duration-180 ${
                        category === c.key
                          ? 'border-primary bg-primary-tint'
                          : 'border-app-border bg-white hover:border-primary/40'
                      }`}
                    >
                      <span className="text-xl">{c.emoji}</span>
                      <span className="text-xs font-semibold text-text-main">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-main mb-1.5">Описание *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
                  placeholder="Что нужно сделать?"
                  rows={4}
                  className="w-full rounded-btn border border-app-border bg-white p-3 text-[15px] text-text-main placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-text-main">Бюджет, BYN</label>
                <button
                  onClick={() => {
                    setNegotiable(!negotiable);
                    impact('light');
                  }}
                  className={`px-3 h-8 rounded-full text-xs font-semibold transition ${
                    negotiable ? 'bg-primary-tint text-primary' : 'bg-app-surface-alt text-text-muted'
                  }`}
                >
                  По договоренности
                </button>
              </div>

              {!negotiable && (
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0"
                  inputMode="numeric"
                  className="w-full rounded-btn border border-app-border bg-white p-3 text-[15px] text-text-main placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
                />
              )}

              <div>
                <label className="block text-sm font-semibold text-text-main mb-1.5">Адрес *</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value.slice(0, 200))}
                  placeholder="Минск-Мир, ул. Братская, 1"
                  className="w-full rounded-btn border border-app-border bg-white p-3 text-[15px] text-text-main placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-main mb-1.5">Фото (до 5)</label>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full h-20 rounded-bento border border-dashed border-app-border bg-app-bg flex items-center justify-center text-text-muted text-sm font-medium hover:border-primary/50 transition"
                >
                  + Прикрепить
                </button>
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" />
              </div>

              {error && <p className="text-sm text-error">{error}</p>}

              <button
                onClick={submit}
                disabled={submitting}
                className="w-full h-12 rounded-btn bg-primary hover:bg-primary-hover text-white font-semibold shadow-accent-glow transition-all duration-180 disabled:opacity-60 active:scale-[0.98]"
              >
                {submitting ? 'Публикую...' : 'Опубликовать заявку'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
