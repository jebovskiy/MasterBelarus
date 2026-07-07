import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useHaptic } from '@/hooks/useHaptic';
import { apiGet, apiPost } from '@/lib/api';
import { useToastStore } from '@/components/shared/Toast';
import { useAuthStore } from '@/stores/auth';
import { sheetTransition } from '@/lib/transitions';

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
  client_id: string;
  master_id?: string;
};

type Bid = {
  id: string;
  master_id: string;
  proposed_price: number | null;
  comment: string | null;
  created_at: string;
};

const STATUS_BADGE: Record<string, string> = { open: 'bg-amber-50 text-amber-700', in_progress: 'bg-blue-50 text-blue-700', completed: 'bg-emerald-50 text-emerald-700', cancelled: 'bg-rose-50 text-rose-600' };

function timeAgo(iso: string, t: (key: string) => string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return t('common.just_now');
  if (diff < 60) return `${diff} ${t('common.min_ago')}`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `${h} ${t('common.hour_ago')}`;
  return `${Math.floor(h / 24)} ${t('common.day_ago')}`;
}

const inputCls = 'w-full bg-[#f4f4f6] text-slate-800 placeholder-slate-400 rounded-xl p-4 border-transparent focus:ring-2 focus:ring-slate-400 focus:bg-white transition-all outline-none text-base';

const swipeConfidenceThreshold = 80;
const swipeVelocityThreshold = 400;

type Props = { orderId: string | null; onBack: () => void; onOpenChat?: (orderId: string) => void };

export default function OrderDetail({ orderId, onBack, onOpenChat }: Props) {
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewData, setReviewData] = useState<{ rating: number; comment: string | null; created_at: string; master: { id: string; full_name: string | null; phone: string | null; avg_rating: number | null; review_count: number | null } | null } | null>(null);
  const [showCancelSheet, setShowCancelSheet] = useState(false);
  const [selectedReason, setSelectedReason] = useState<number | null>(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const { impact, notification } = useHaptic();
  const showToast = useToastStore((s) => s.showToast);
  const currentRole = useAuthStore((s) => s.profile?.current_role);
  const { t } = useTranslation();
  const CLIENT_REASONS = [
    { id: 1, label: t('orders.cancel_reasons.client_1') },
    { id: 2, label: t('orders.cancel_reasons.client_2') },
    { id: 3, label: t('orders.cancel_reasons.client_3') },
    { id: 4, label: t('orders.cancel_reasons.client_4') },
    { id: 5, label: t('orders.cancel_reasons.client_5') },
  ];
  const MASTER_REASONS = [
    { id: 10, label: t('orders.cancel_reasons.master_10') },
    { id: 11, label: t('orders.cancel_reasons.master_11') },
    { id: 12, label: t('orders.cancel_reasons.master_12') },
  ];

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
      if (orderRes.data) {
        setOrder(orderRes.data);
        const s = orderRes.data.status;
        if (s === 'completed' || s === 'cancelled') {
          const revRes = await apiGet<typeof reviewData>(`/orders/${orderId}/review`);
          if ('data' in revRes && revRes.data) setReviewData(revRes.data);
        }
      }
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
    if ('error' in res) { notification('error'); showToast(t('toast.bid_accept_error'), 'error'); return; }
    notification('success');
    showToast(t('toast.master_selected'), 'success');
    setOrder((prev) => (prev ? { ...prev, status: 'in_progress' } : prev));
  };

  const submitReview = async () => {
    if (!orderId) return;
    setReviewSubmitting(true);
    impact('medium');
    const res = await apiPost(`/orders/${orderId}/review`, { rating: reviewRating, comment: reviewComment });
    setReviewSubmitting(false);
    if ('error' in res) { notification('error'); showToast(t('toast.review_error'), 'error'); return; }
    notification('success');
    showToast(t('toast.review_saved'), 'success');
    setOrder((prev) => (prev ? { ...prev, status: 'completed' } : prev));
  };

  const openCancel = () => {
    impact('medium');
    setSelectedReason(null);
    setShowCancelSheet(true);
  };

  const reactivateOrder = async () => {
    if (!orderId) return;
    setReactivating(true);
    impact('medium');
    const res = await apiPost(`/orders/${orderId}/reactivate`, {});
    setReactivating(false);
    if ('error' in res) { notification('error'); showToast(t('toast.reactivate_error'), 'error'); return; }
    notification('success');
    showToast(t('toast.reactivated'), 'success');
    setOrder((prev) => (prev ? { ...prev, status: 'open' } : prev));
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
    if ('error' in res) { notification('error'); showToast(res.error ?? t('toast.cancel_error'), 'error'); return; }
    notification('warning');
    showToast(t('toast.order_cancelled'), 'warning');
    setShowCancelSheet(false);
    setOrder((prev) => (prev ? { ...prev, status: 'cancelled', cancelled_by: currentRole === 'master' ? 'master' : 'client', cancellation_reason_id: selectedReason } : prev));
  };

  const profile = useAuthStore((s) => s.profile);
  const role = currentRole ?? 'customer';
  const reasons = role === 'master' ? MASTER_REASONS : CLIENT_REASONS;
  const canCancelClient = role === 'customer' && order?.status === 'open';
  const canCancelMaster = role === 'master' && order?.status === 'in_progress';
  const isOwner = order !== null && profile !== null && order.client_id === profile.id;

  const footerActions = (() => {
    if (loading || !order) return null;
    if (error) return (
      <button onClick={load} className="w-full bg-slate-900 text-white rounded-xl py-4 font-semibold text-sm shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all">{t('orders.retry')}</button>
    );
    if (order.status === 'in_progress' && isOwner) return (
      <div className="space-y-2">
        <button onClick={submitReview} disabled={reviewSubmitting} className="w-full bg-slate-900 text-white rounded-xl py-4 font-semibold text-sm shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50">
          {reviewSubmitting ? t('orders.submitting_review') : t('orders.complete_and_review')}
        </button>
        <button onClick={openCancel} className="w-full bg-white border-2 border-rose-200 text-rose-600 rounded-xl py-3.5 text-sm font-semibold hover:scale-[1.02] active:scale-[0.98] transition-all hover:border-rose-300">
          {t('orders.refuse_order')}
        </button>
      </div>
    );
    if (canCancelClient) return (
      <button onClick={openCancel} className="w-full bg-white border-2 border-rose-200 text-rose-600 rounded-xl py-3.5 text-sm font-semibold hover:scale-[1.02] active:scale-[0.98] transition-all hover:border-rose-300">
        {t('orders.cancel')}
      </button>
    );
    if (canCancelMaster) return (
      <button onClick={openCancel} className="w-full bg-white border-2 border-rose-200 text-rose-600 rounded-xl py-3.5 text-sm font-semibold hover:scale-[1.02] active:scale-[0.98] transition-all hover:border-rose-300">
        {t('orders.refuse_order')}
      </button>
    );
    return null;
  })();

  return (
    <AnimatePresence>
      {orderId && (
        <motion.div key={orderId} className="fixed inset-0 z-[60] flex flex-col justify-end bg-slate-900/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={sheetTransition}>
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
                onBack();
              }
            }}
          >
            <div className="flex flex-col items-center py-3 border-b border-slate-100 bg-white rounded-t-[24px] shrink-0">
              <div className="h-1 w-12 rounded-full bg-slate-300 mb-2" />
              <div className="flex items-center justify-between w-full px-5">
                <button onClick={onBack} className="text-sm font-semibold text-slate-500">{t('common.back')}</button>
                <h3 className="text-base font-semibold text-slate-800">{t('orders.detail_title')}</h3>
                <div className="flex items-center gap-2">
                  {order?.status === 'in_progress' && onOpenChat && (
                    <button onClick={() => onOpenChat(order.id)} className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full hover:bg-slate-200 transition-colors">
                      💬 {t('chat.chat_btn')}
                    </button>
                  )}
                  {order && (
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[order.status] ?? 'bg-slate-100 text-slate-500'}`}>
                      {t(`orders.status.${order.status}`)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pt-5 pb-32 space-y-5">
              {error && (
                <div className="bg-rose-50 text-rose-600 p-4 rounded-xl text-sm">{error}</div>
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
                      <span className="text-lg">{t(`home.categories.${order.category}`)}</span>
                      <span className="text-xs text-slate-400 ml-auto">{timeAgo(order.created_at, t)}</span>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{order.description}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>📍</span>
                      <span>{order.address_text}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <p className="text-2xl font-extrabold text-slate-900">
                        {order.is_negotiable ? t('master.negotiable') : `${order.price ?? 0} BYN`}
                      </p>
                    </div>
                    {order.images.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1 scrollbar-none">
                        {order.images.map((url, i) => (
                          <img
                            key={i}
                            src={url}
                            alt=""
                            className="w-24 h-24 rounded-xl object-cover shrink-0 bg-slate-100"
                            loading="lazy"
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {order.status === 'open' && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold text-slate-800">{t('orders.bids_count', { count: bids.length })}</h3>
                      {bids.length === 0 && (
                        <p className="text-sm text-slate-400">{t('orders.no_bids')}</p>
                      )}
                      {bids.map((bid, idx) => (
                        <motion.div
                          key={bid.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(idx * 0.04, 0.5) }}
                          className="bg-white rounded-xl p-5 border border-slate-100 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{t('orders.master_label', { id: bid.master_id.slice(0, 6) })}</p>
                              <p className="text-xs text-slate-400">{timeAgo(bid.created_at, t)}</p>
                            </div>
                            <p className="text-lg font-extrabold text-slate-900">
                              {bid.proposed_price ? `${bid.proposed_price} BYN` : t('master.negotiable')}
                            </p>
                          </div>
                          {bid.comment && <p className="text-sm text-slate-500">{bid.comment}</p>}
                          <button
                            onClick={() => acceptBid(bid.id)}
                            disabled={acceptingId === bid.id}
                            className="w-full bg-slate-900 text-white rounded-xl py-3.5 text-sm font-semibold disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] transition-all"
                          >
                            {acceptingId === bid.id ? t('orders.accepting') : t('orders.select_master')}
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {order.status === 'in_progress' && isOwner && (
                    <div className="bg-[#f4f4f6] rounded-xl p-5 space-y-4">
                      <p className="text-sm font-bold text-slate-800">{t('orders.leave_review')}</p>
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
                        placeholder={t('orders.review_placeholder')}
                        className={`${inputCls} resize-none`}
                        rows={3}
                      />
                    </div>
                  )}

                  {order.status === 'completed' && (
                    <div className="space-y-4">
                      <div className="text-center py-4 space-y-1">
                        <span className="text-4xl block">✅</span>
                        <p className="text-sm font-semibold text-slate-700">{t('orders.completed_status')}</p>
                      </div>
                      {reviewData && (
                        <div className="bg-white rounded-xl p-5 border border-slate-100 space-y-3">
                          {reviewData.master && (
                            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-500">
                                {(reviewData.master.full_name ?? 'М')[0]}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-800">{reviewData.master.full_name ?? 'Мастер'}</p>
                                <p className="text-xs text-slate-400">⭐ {reviewData.master.avg_rating ?? '—'} ({reviewData.master.review_count ?? 0})</p>
                              </div>
                            </div>
                          )}
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span key={star} className={`text-lg ${star <= reviewData.rating ? 'text-amber-400' : 'text-slate-200'}`}>★</span>
                            ))}
                          </div>
                          {reviewData.comment && <p className="text-sm text-slate-600">{reviewData.comment}</p>}
                        </div>
                      )}
                    </div>
                  )}

                  {order.status === 'cancelled' && (
                    <div className="space-y-4">
                      <div className="text-center py-4 space-y-1">
                        <span className="text-4xl block">❌</span>
                        <p className="text-sm font-semibold text-slate-700">{t('orders.cancelled_status')}</p>
                      </div>
                      <div className="bg-white rounded-xl p-5 border border-slate-100 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">{t('orders.cancelled_by')}</span>
                          <span className="font-semibold text-slate-800">
                            {order.cancelled_by === 'master' ? t('orders.cancelled_by_master') : t('orders.cancelled_by_client')}
                          </span>
                        </div>
                        {order.cancellation_reason_id != null && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">{t('orders.cancel_reason')}</span>
                            <span className="font-semibold text-slate-800 text-right max-w-[60%]">{t(`orders.cancel_reasons.${order.cancelled_by === 'master' ? `master_${order.cancellation_reason_id}` : `client_${order.cancellation_reason_id}`}` as string)}</span>
                          </div>
                        )}
                      </div>
                      {order.cancelled_by === 'master' && isOwner && (
                        <button onClick={reactivateOrder} disabled={reactivating} className="w-full bg-slate-900 text-white rounded-xl py-4 font-semibold text-sm shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50">
                          {reactivating ? t('orders.reactivating') : t('orders.reactivate')}
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {footerActions && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent pt-8 pb-[calc(24px+env(safe-area-inset-bottom,0px))] px-5">
                {footerActions}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}

      <AnimatePresence>
        {showCancelSheet && (
          <motion.div className="fixed inset-0 z-[60] flex flex-col justify-end bg-slate-900/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={sheetTransition}>
            <motion.div
              className="relative flex max-h-[70vh] w-full max-w-[430px] mx-auto flex-col rounded-t-[24px] bg-slate-50 shadow-2xl"
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
              <div className="flex flex-col items-center py-3 border-b border-slate-100 bg-white rounded-t-[24px] shrink-0">
                <div className="h-1 w-12 rounded-full bg-slate-300 mb-2" />
                <h3 className="text-base font-semibold text-slate-800">{t('orders.cancel_reason_title')}</h3>
              </div>
              <div className="flex-1 overflow-y-auto px-5 pt-5 pb-32 space-y-2">
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
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent pt-8 pb-[calc(24px+env(safe-area-inset-bottom,0px))] px-5">
                <button onClick={submitCancel} disabled={selectedReason === null || cancelSubmitting} className="w-full bg-rose-600 text-white rounded-xl py-4 font-semibold text-sm shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-40">
                  {cancelSubmitting ? t('orders.cancelling') : t('orders.confirm_cancel')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}
