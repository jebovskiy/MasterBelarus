import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useHaptic } from '@/hooks/useHaptic';
import { apiGet, apiPost } from '@/lib/api';

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
};

type Bid = {
  id: string;
  master_id: string;
  proposed_price: number | null;
  comment: string | null;
  created_at: string;
};

const EMOJI: Record<string, string> = { plumber: '🔧', electrician: '⚡', mover: '📦', handyman: '🛠', tutor: '📚', cleaning: '🧹' };
const STATUS_BADGE: Record<string, string> = { open: 'bg-primary-tint text-primary', in_progress: 'bg-[#FEF3C7] text-[#92400E]', completed: 'bg-success-tint text-success', cancelled: 'bg-red-50 text-error' };
const STATUS_LABEL: Record<string, string> = { open: 'Открыт', in_progress: 'В работе', completed: 'Завершён', cancelled: 'Отменён' };

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'только что';
  if (diff < 60) return `${diff} мин`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `${h} ч`;
  return `${Math.floor(h / 24)} дн.`;
}

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
  const { impact, notification } = useHaptic();

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
    if ('error' in res) { notification('error'); console.warn('[accept]', res.error); return; }
    notification('success');
    setOrder((prev) => (prev ? { ...prev, status: 'in_progress' } : prev));
  };

  const submitReview = async () => {
    if (!orderId) return;
    setReviewSubmitting(true);
    impact('medium');
    const res = await apiPost(`/orders/${orderId}/review`, { rating: reviewRating, comment: reviewComment });
    setReviewSubmitting(false);
    if ('error' in res) { notification('error'); return; }
    notification('success');
    setOrder((prev) => (prev ? { ...prev, status: 'completed' } : prev));
  };

  if (!orderId) return null;

  return (
    <div className="fixed inset-0 z-50 bg-app-bg overflow-auto">
      <header className="sticky top-0 z-10 bg-app-bg/80 backdrop-blur-md border-b border-app-border">
        <div className="max-w-[430px] mx-auto flex items-center justify-between px-4 h-14">
          <button onClick={onBack} className="px-3 h-8 rounded-btn bg-app-surface-alt text-sm font-semibold">Назад</button>
          {order && <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[order.status] ?? 'bg-gray-100'}`}>{STATUS_LABEL[order.status] ?? order.status}</span>}
        </div>
      </header>

      <div className="max-w-[430px] mx-auto px-4 py-4 space-y-4">
        {error && <div className="bg-red-50 text-error p-3 rounded-bento text-sm">{error} <button onClick={load} className="ml-2 underline font-semibold">Повторить</button></div>}
        {loading && <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-28 rounded-bento bg-white shadow-card animate-pulse" />)}</div>}
        {!loading && order && (
          <>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-5 rounded-bento shadow-card">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{EMOJI[order.category] ?? '📋'}</span>
                <h2 className="text-base font-bold text-text-main">{order.category}</h2>
                <span className="text-xs text-text-muted ml-auto">{timeAgo(order.created_at)}</span>
              </div>
              <p className="text-sm text-text-main leading-relaxed">{order.description}</p>
              <div className="mt-3 flex items-center gap-2 text-xs text-text-muted"><span>📍 {order.address_text}</span></div>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-2xl font-extrabold text-primary">{order.is_negotiable ? 'Договорная' : `${order.price ?? 0} BYN`}</p>
                {order.images.length > 0 && <span className="text-xs text-text-muted">📎 {order.images.length}</span>}
              </div>
            </motion.div>

            {order.status === 'open' && (
              <div>
                <h3 className="text-sm font-bold text-text-main mb-2 px-1">Отклики ({bids.length})</h3>
                {bids.length === 0 && <p className="text-sm text-text-muted px-1">Мастера ещё не откликнулись.</p>}
                <div className="space-y-3">
                  {bids.map((bid, idx) => (
                    <motion.div key={bid.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 40 }} className="bg-white p-4 rounded-bento shadow-card">
                      <div className="flex items-center justify-between mb-2">
                        <div><p className="text-sm font-semibold text-text-main">Мастер #{bid.master_id.slice(0, 6)}</p><p className="text-xs text-text-muted">{timeAgo(bid.created_at)}</p></div>
                        <p className="text-lg font-extrabold text-primary">{bid.proposed_price ? `${bid.proposed_price} BYN` : 'Договорная'}</p>
                      </div>
                      {bid.comment && <p className="text-sm text-text-secondary mb-3">{bid.comment}</p>}
                      <button onClick={() => acceptBid(bid.id)} disabled={acceptingId === bid.id} className="w-full h-10 rounded-btn bg-primary hover:bg-primary-hover text-white text-sm font-semibold disabled:opacity-50 active:scale-[0.98] transition">
                        {acceptingId === bid.id ? 'Принимаю...' : 'Выбрать этого мастера'}
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {order.status === 'in_progress' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white p-5 rounded-bento shadow-card">
                <p className="text-sm font-semibold text-text-main mb-2">Оставить отзыв о выполнении</p>
                <div className="flex gap-2 mb-3">{[1, 2, 3, 4, 5].map((star) => (<button key={star} onClick={() => { setReviewRating(star); impact('light'); }} className={`text-2xl transition ${star <= reviewRating ? 'scale-110' : 'opacity-30'}`}>★</button>))}</div>
                <textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value.slice(0, 1000))} placeholder="Ваш отзыв..." className="w-full rounded-btn border border-app-border bg-white p-3 text-sm mb-3" />
                <button onClick={submitReview} disabled={reviewSubmitting} className="w-full h-11 rounded-btn bg-primary hover:bg-primary-hover text-white font-semibold disabled:opacity-50">
                  {reviewSubmitting ? 'Отправляю...' : 'Завершить и оценить'}
                </button>
              </motion.div>
            )}

            {order.status === 'completed' && <div className="text-center py-6"><span className="text-4xl">✅</span><p className="text-sm font-semibold text-text-main mt-2">Заказ завершён</p></div>}
          </>
        )}
      </div>
    </div>
  );
}
