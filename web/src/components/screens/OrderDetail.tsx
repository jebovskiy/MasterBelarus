import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHaptic } from '@/hooks/useHaptic';
import { apiGet, apiPost } from '@/lib/api';
import { useToastStore } from '@/components/shared/Toast';
import { useAuthStore } from '@/stores/auth';

type OrderRow = {
  id: string;
  category: string;
  description: string;
  price: number | null;
  is_negotiable: boolean;
  address_text: string;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  images: string[];
  created_at: string;
  cancelled_by?: string;
  cancellation_reason_id?: number;
  cancellation_reason_text?: string;
};

type Bid = {
  id: string;
  master_id: string;
  proposed_price: number | null;
  comment: string | null;
  created_at: string;
};

const CLIENT_REASONS = [
  { id: 1, label: 'Создал по ошибке / Тестирую' },
  { id: 2, label: 'Мастер не выходит на связь' },
  { id: 3, label: 'Услуга больше не нужна' },
  { id: 4, label: 'Нашел исполнителя в другом месте' },
  { id: 5, label: 'Другое' },
];

const MASTER_REASONS = [
  { id: 10, label: 'Клиент неадекватен / не отвечает' },
  { id: 11, label: 'Неверно указан объем работ' },
  { id: 12, label: 'Форс-мажор / Заболел' },
];

const EMOJI: Record<string, string> = { plumber: '🔧', electrician: '⚡', mover: '📦', handyman: '🛠', tutor: '📚', cleaning: '🧹' };
const STATUS_BADGE: Record<string, string> = { open: 'bg-amber-50 text-amber-700', in_progress: 'bg-blue-50 text-blue-700', completed: 'bg-emerald-50 text-emerald-700', cancelled: 'bg-rose-50 text-rose-600' };
const STATUS_LABEL: Record<string, string> = { open: 'Открыт', in_progress: 'В работе', completed: 'Завершён', cancelled: 'Отменён' };

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'только что';
  if (diff < 60) return `${diff} мин`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `${h} ч`;
  return `${Math.floor(h / 24)} дн.`;
}

const inputCls = 'w-full bg-[#f4f4f6] text-slate-800 placeholder-slate-400 rounded-xl p-4 border-transparent focus:ring-2 focus:ring-slate-400 focus:bg-white transition-all outline-none text-base';

const swipeConfidenceThreshold = 80;
const swipeVelocityThreshold = 400;
const sheetTransition = { duration: 0.25, ease: [0.32, 0.72, 0, 1] };

type Props = { orderId: string | null; onBack: () => void };

export default function OrderDetail({ orderId, onBack }: Props) {
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [showCancelSheet, setShowCancelSheet] = useState(false);
  const [selectedReason, setSelectedReason] = useState<number | null>(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const { impact, notification } = useHaptic();
  const showToast = useToastStore((s) => s.showToast);
  const currentRole = useAuthStore((s) => s.profile?.current_role);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const [orderRes, bidsRes] = await Promise.all([
        apiGet<OrderRow>(`/orders/${orderId}`),
        apiGet<Bid[]>(`/orders/${orderId}/bids`),
      ]);
      if ('error' in orderRes) throw new Error(orderRes.error);
      if ('error' in bidsRes) throw new Error(bidsRes.error);
      if (orderRes.data) setOrder(orderRes.data);
      if (bidsRes.data) setBids(bidsRes.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown');
      notification('error');
    } finally {
      setLoading(false);
    }
  }, [orderId, notification]);

  useEffect(() => { void load(); }, [load]);

  const acceptBid = async (bidId: string) => {
    if (!orderId) return;
    setAcceptingId(bidId);
    impact('medium');
    const res = await apiPost(`/orders/${orderId}/accept-bid/${bidId}`, {});
    setAcceptingId(null);
    if ('error' in res) { notification('error'); showToast('Ошибка при выборе мастера', 'error'); return; }
    notification('success');
    showToast('✅ Мастер выбран!', 'success');
    setOrder((prev) => (prev ? { ...prev, status: 'in_progress' } : prev));
  };

  const submitReview = async () => {
    if (!orderId) return;
    setReviewSubmitting(true);
    impact('medium');
    const res = await apiPost(`/orders/${orderId}/review`, { rating: reviewRating, comment: reviewComment });
    setReviewSubmitting(false);
    if ('error' in res) { notification('error'); showToast('Ошибка при отправке', 'error'); return; }
    notification('success');
    showToast('✅ Отзыв сохранён!', 'success');
    setOrder((prev) => (prev ? { ...prev, status: 'completed' } : prev));
  };

  const openCancel = () => {
    impact('medium');
    setSelectedReason(null);
    setShowCancelSheet(true);
  };

  const submitCancel = async () => {
    if (!orderId || selectedReason === null) return;
    setCancelSubmitting(true);
    impact('medium');
    const res = await apiPost(`/orders/${orderId}/cancel`, {
      cancelled_by: currentRole === 'master' ? 'master' : 'client',
      cancellation_reason_id: selectedReason,
    });
    setCancelSubmitting(false);
    if ('error' in res) { notification('error'); showToast('Ошибка при отмене', 'error'); return; }
    notification('warning');
    showToast('Заказ отменён', 'warning');
    setShowCancelSheet(false);
    setOrder((prev) => (prev ? { ...prev, status: 'cancelled', cancelled_by: currentRole === 'master' ? 'master' : 'client', cancellation_reason_id: selectedReason } : prev));
  };

  const reasons = currentRole === 'master' ? MASTER_REASONS : CLIENT_REASONS;
  const canCancelClient = currentRole === 'customer' && order?.status === 'open' && order?.cancelled_by !== 'client';
  const canCancelMaster = currentRole === 'master' && order?.status === 'in_progress' && order?.cancelled_by !== 'master';

  return (
    <AnimatePresence>
      {orderId && (
        <motion.div key={orderId} className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={sheetTransition}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onBack} />
          <motion.div
            className="absolute bottom-0 left-0 right-0 max-w-[430px] mx-auto bg-white rounded-t-2xl shadow-lg shadow-slate-200/50 flex flex-col max-h-[90vh]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={sheetTransition}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > swipeConfidenceThreshold || info.velocity.y > swipeVelocityThreshold) {
                onBack();
              }
            }}
          >
            <div className="flex justify-center pt-3 pb-2 shrink-0 cursor-grab active:cursor-grabbing">
              <div className="h-1.5 w-10 rounded-full bg-slate-300" />
            </div>
            <div className="px-6 pb-6 overflow-auto space-y-5">
              <div className="flex items-center justify-between pt-1">
                <h2 className="text-xl font-bold text-slate-800">Детали заказа</h2>
                {order && (
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[order.status] ?? 'bg-slate-100 text-slate-500'}`}>
                    {STATUS_LABEL[order.status] ?? order.status}
                  </span>
                )}
              </div>

              {error && (
                <div className="bg-rose-50 text-rose-600 p-4 rounded-xl text-sm flex items-center justify-between">
                  <span>{error}</span>
                  <button onClick={load} className="underline font-semibold ml-2 shrink-0">Повторить</button>
                </div>
              )}

              {loading && (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="bg-white rounded-xl p-5 animate-pulse space-y-2 border border-slate-100">
                      <div className="h-4 w-24 bg-slate-200 rounded" />
                      <div className="h-3 w-full bg-slate-100 rounded" />
                      <div className="h-3 w-3/4 bg-slate-100 rounded" />
                    </div>
                  ))}
                </div>
              )}

              {!loading && order && (
                <>
                  <div className="bg-[#f4f4f6] rounded-xl p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{EMOJI[order.category] ?? '📋'}</span>
                      <span className="text-base font-bold text-slate-800">{order.category}</span>
                      <span className="text-xs text-slate-400 ml-auto">{timeAgo(order.created_at)}</span>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{order.description}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>📍</span>
                      <span>{order.address_text}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <p className="text-2xl font-extrabold text-slate-900">
                        {order.is_negotiable ? 'Договорная' : `${order.price ?? 0} BYN`}
                      </p>
                      {order.images.length > 0 && (
                        <span className="text-xs text-slate-400">📎 {order.images.length} фото</span>
                      )}
                    </div>
                  </div>

                  {order.status === 'open' && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold text-slate-800">Отклики ({bids.length})</h3>
                      {bids.length === 0 && (
                        <p className="text-sm text-slate-400">Мастера ещё не откликнулись.</p>
                      )}
                      {bids.map((bid, idx) => (
                        <motion.div
                          key={bid.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          className="bg-white rounded-xl p-5 border border-slate-100 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-slate-800">Мастер #{bid.master_id.slice(0, 6)}</p>
                              <p className="text-xs text-slate-400">{timeAgo(bid.created_at)}</p>
                            </div>
                            <p className="text-lg font-extrabold text-slate-900">
                              {bid.proposed_price ? `${bid.proposed_price} BYN` : 'Договорная'}
                            </p>
                          </div>
                          {bid.comment && <p className="text-sm text-slate-500">{bid.comment}</p>}
                          <button
                            onClick={() => acceptBid(bid.id)}
                            disabled={acceptingId === bid.id}
                            className="w-full bg-slate-900 text-white rounded-xl py-3.5 text-sm font-semibold disabled:opacity-50 active:scale-[0.98] transition-all"
                          >
                            {acceptingId === bid.id ? 'Принимаю...' : 'Выбрать этого мастера'}
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {order.status === 'in_progress' && (
                    <div className="bg-[#f4f4f6] rounded-xl p-5 space-y-4">
                      <p className="text-sm font-bold text-slate-800">Оставить отзыв о выполнении</p>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => { setReviewRating(star); impact('light'); }}
                            className={`text-2xl transition-all ${star <= reviewRating ? 'text-amber-400 scale-110' : 'text-slate-300'}`}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value.slice(0, 1000))}
                        placeholder="Ваш отзыв..."
                        className={`${inputCls} resize-none`}
                        rows={3}
                      />
                      <button
                        onClick={submitReview}
                        disabled={reviewSubmitting}
                        className="w-full bg-slate-900 text-white rounded-xl py-3.5 text-sm font-semibold disabled:opacity-50 active:scale-[0.98] transition-all"
                      >
                        {reviewSubmitting ? 'Отправляю...' : 'Завершить и оценить'}
                      </button>
                    </div>
                  )}

                  {(canCancelClient || canCancelMaster) && (
                    <button
                      onClick={openCancel}
                      className="w-full bg-white border-2 border-rose-200 text-rose-600 rounded-xl py-3.5 text-sm font-semibold active:scale-[0.98] transition-all hover:border-rose-300"
                    >
                      {currentRole === 'master' ? 'Отказаться от заказа' : 'Отменить заказ'}
                    </button>
                  )}

                  {order.status === 'completed' && (
                    <div className="text-center py-8 space-y-2">
                      <span className="text-4xl">✅</span>
                      <p className="text-sm font-semibold text-slate-700">Заказ завершён</p>
                    </div>
                  )}

                  {order.status === 'cancelled' && (
                    <div className="text-center py-8 space-y-2">
                      <span className="text-4xl">❌</span>
                      <p className="text-sm font-semibold text-slate-700">Заказ отменён</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}

      <AnimatePresence>
        {showCancelSheet && (
          <motion.div className="fixed inset-0 z-[60]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={sheetTransition}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCancelSheet(false)} />
            <motion.div
              className="absolute bottom-0 left-0 right-0 max-w-[430px] mx-auto bg-white rounded-t-2xl shadow-lg shadow-slate-200/50 flex flex-col"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={sheetTransition}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.4 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > swipeConfidenceThreshold || info.velocity.y > swipeVelocityThreshold) {
                  setShowCancelSheet(false);
                }
              }}
            >
              <div className="flex justify-center pt-3 pb-2 shrink-0 cursor-grab active:cursor-grabbing">
                <div className="h-1.5 w-10 rounded-full bg-slate-300" />
              </div>
              <div className="px-6 pb-8 space-y-4">
                <h3 className="text-lg font-bold text-slate-800">Причина отмены</h3>
                <div className="space-y-2">
                  {reasons.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setSelectedReason(r.id)}
                      className={`w-full text-left p-4 rounded-xl text-sm transition-all ${
                        selectedReason === r.id
                          ? 'bg-slate-900 text-white font-semibold'
                          : 'bg-[#f4f4f6] text-slate-700 active:bg-slate-200'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={submitCancel}
                  disabled={selectedReason === null || cancelSubmitting}
                  className="w-full bg-rose-600 text-white rounded-xl py-3.5 text-sm font-semibold disabled:opacity-40 active:scale-[0.98] transition-all"
                >
                  {cancelSubmitting ? 'Отменяю...' : 'Подтвердить отмену'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}
