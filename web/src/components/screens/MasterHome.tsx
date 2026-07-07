import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/stores/auth';
import { useHaptic } from '@/hooks/useHaptic';
import { useLocation } from '@/hooks/useLocation';
import { Avatar } from '@/components/shared/Avatar';
import { apiPost, apiGet, isErrorResult } from '@/lib/api';
import { useToastStore } from '@/components/shared/Toast';
import { useTranslation } from 'react-i18next';
import CitySelector, { type CityValue } from '@/components/shared/CitySelector';
import { sheetTransition } from '@/lib/transitions';

type NearbyOrder = {
  id: string;
  category: string;
  description: string;
  price: number | null;
  is_negotiable: boolean;
  address_text: string;
  distance_m: number;
  created_at: string;
};

type ReviewItem = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  client: { full_name: string | null; username: string | null; avatar_url: string | null } | null;
};

function formatPhone(phone?: string | null): string {
  if (!phone) return '+375 (XX) XXX-XX-XX';
  const d = phone.replace(/\D/g, '');
  if (d.length < 7) return phone;
  const code = d.slice(0, 3);
  const op = d.slice(3, 5);
  const rest = d.slice(5);
  if (rest.length === 7) {
    return `+${code} (${op}) ${rest.slice(0, 3)}-${rest.slice(3, 5)}-${rest.slice(5)}`;
  }
  return `+${code} (${op}) ${rest}`;
}

export function MasterHome({ onNavigate }: { onNavigate?: (screen: string) => void }) {
  const { t } = useTranslation();
  const profile = useAuthStore((s) => s.profile);
  const [orders, setOrders] = useState<NearbyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<number>(profile?.response_credits ?? 0);
  const [stats, setStats] = useState({ completed: 0, inProgress: 0, todayBids: 0 });
  const [filterCity, setFilterCity] = useState<CityValue | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bidPrice, setBidPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bidOrderIds, setBidOrderIds] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<'nearby' | 'completed'>('nearby');
  const [completedOrders, setCompletedOrders] = useState<NearbyOrder[]>([]);
  const [completedLoading, setCompletedLoading] = useState(false);
  const [reviewSheet, setReviewSheet] = useState(false);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const { impact, notification } = useHaptic();
  const { location } = useLocation();
  const showToast = useToastStore((s) => s.showToast);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        lat: String(location.latitude),
        lng: String(location.longitude),
        radius: '5000',
      });
      if (filterCity) params.set('city', filterCity.city);
      const [ordersResult, meResult] = await Promise.all([
        apiGet<NearbyOrder[]>(`/orders/nearby?${params}`),
        apiGet<{ balance: number; stats: { completed: number; inProgress: number; todayBids: number } }>('/masters/me'),
      ]);
      if ('data' in ordersResult && Array.isArray(ordersResult.data)) {
        setOrders(ordersResult.data);
      }
      if ('data' in meResult && meResult.data) {
        setBalance(meResult.data.balance);
        setStats(meResult.data.stats);
      }
    } catch (e) {
      console.warn('[master] nearby failed', e);
    } finally {
      setLoading(false);
    }
  }, [location.latitude, location.longitude, filterCity]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const id = setInterval(() => { if (!document.hidden) void load(); }, 30000);
    const onVis = () => { if (document.hidden) clearInterval(id); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [load]);

  const loadCompleted = useCallback(async () => {
    setCompletedLoading(true);
    const result = await apiGet<{ orders: NearbyOrder[] }>('/orders/completed');
    if ('data' in result && result.data) {
      setCompletedOrders(result.data.orders ?? []);
    }
    setCompletedLoading(false);
  }, []);

  useEffect(() => {
    if (tab === 'completed') void loadCompleted();
  }, [tab, loadCompleted]);

  const openOrder = (order: NearbyOrder) => {
    setSelectedId(order.id);
    setBidPrice('');
    impact('light');
  };

  const submitBid = async () => {
    if (!selectedId) return;
    setSubmitting(true);
    impact('medium');
    const result = await apiPost<{ id: string }>(`/orders/${selectedId}/bids`, {
      proposed_price: bidPrice ? Number(bidPrice) : null,
      comment: '',
    });
    setSubmitting(false);
    if (isErrorResult(result)) {
      notification('error');
      showToast(t('common.error') + ': ' + (result.detail ?? result.error), 'error');
      return;
    }
    notification('success');
    showToast(t('toast.bid_placed'), 'success');
    setBidOrderIds((prev) => new Set(prev).add(selectedId));
    setSelectedId(null);
    setBidPrice('');
  };

  const selected = orders.find((o) => o.id === selectedId);

  return (
    <div className="min-h-screen bg-app-bg">
      <div className="px-4 pt-4 space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Avatar size={48} name={profile?.full_name ?? t('master.default_name')} src={profile?.avatar_url ?? undefined} />
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-slate-800 truncate">{profile?.full_name ?? t('master.default_name')}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-amber-500 text-xs">★</span>
                <span className="text-slate-600 text-xs font-semibold">{(profile?.avg_rating ?? 5.0).toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {profile?.is_npd && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold">{t('master.npd_badge')}</span>
                )}
                {profile?.master_status === 'approved' && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-semibold">{t('master.checked_badge')}</span>
                )}
                <span className="text-xs text-slate-500 font-medium">{t('master.contact_label')} {formatPhone(profile?.phone)}</span>
              </div>
            </div>
            {balance !== null && <div className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">💎 {balance}</div>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 bg-white p-5 rounded-bento shadow-card">
            <p className="text-sm font-semibold text-text-muted">{t('master.balance_title')}</p>
            <p className="text-4xl font-extrabold text-primary mt-1">{balance ?? '—'}</p>
            <button onClick={() => onNavigate?.('wallet')} className="mt-2 text-sm font-semibold text-primary">{t('master.top_up')}</button>
          </div>
          <button
            onClick={async () => {
              impact('light');
              setReviewSheet(true);
              setReviewsLoading(true);
              const res = await apiGet<ReviewItem[]>('/masters/me/reviews');
              if ('data' in res && Array.isArray(res.data)) {
                setReviews(res.data);
              }
              setReviewsLoading(false);
            }}
            className="bg-white p-4 rounded-bento shadow-card flex flex-col justify-between text-left"
          >
            <p className="text-sm font-semibold text-text-muted">{t('master.rating')}</p>
            <p className="text-2xl font-extrabold text-text-main mt-1">{profile?.review_count && profile?.avg_rating ? `${profile.avg_rating.toFixed(1)} ★` : '—'}</p>
            <p className="text-xs text-text-muted">{profile?.review_count ? `${profile.review_count} ${t('master.ratings_count')}` : ''}</p>
          </button>
        </div>

        <div className="flex items-center justify-between px-4 py-3 bg-white rounded-bento shadow-card text-xs text-text-muted font-medium">
          <span>{t('master.completed_label')} <strong className="text-text-main">{stats.completed}</strong></span>
          <span className="text-app-border">|</span>
          <span>{t('master.in_progress_label')} <strong className="text-text-main">{stats.inProgress}</strong></span>
          <span className="text-app-border">|</span>
          <span>{t('master.today_label')} <strong className="text-primary">{stats.todayBids}</strong></span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">{t('master.filter_city')}</label>
            <CitySelector value={filterCity} onChange={setFilterCity} />
          </div>
          {filterCity && (
            <button
              onClick={() => setFilterCity(null)}
              className="mt-5 shrink-0 text-xs font-semibold text-rose-500 active:text-rose-600"
            >
              {t('master.reset_filter')}
            </button>
          )}
        </div>

        <button onClick={() => onNavigate?.('edit_profile')} className="w-full bg-slate-900 text-white rounded-xl py-4 text-center text-sm font-semibold hover:scale-[1.02] active:scale-[0.99] transition-transform">
          {t('profile.edit_profile')}
        </button>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setTab('nearby')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === 'nearby' ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-600 shadow-sm'}`}
            >
              {t('master.search_tab')}
            </button>
            <button
              onClick={() => setTab('completed')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === 'completed' ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-600 shadow-sm'}`}
            >
              {t('master.completed_tab')} ({stats.completed})
            </button>
          </div>

          {tab === 'nearby' && (
            <>
              <div className="flex items-center justify-between px-1 mb-2">
                <h2 className="text-lg font-bold text-text-main">{t('master.orders_nearby_title')}</h2>
                <button onClick={load} className="text-sm font-semibold text-primary">{t('master.refresh')}</button>
              </div>
              {loading && <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-32 rounded-bento bg-white shadow-card animate-pulse" />)}</div>}
              {!loading && orders.length === 0 && <div className="text-center py-10 text-text-muted text-sm">{t('master.no_orders_nearby')}</div>}
              <div className="space-y-3">
                {orders.map((order, idx) => (
                  <motion.div key={order.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.04, 0.5) }} onClick={() => openOrder(order)} className="bg-white p-4 rounded-bento shadow-card hover:scale-[1.02] active:scale-[0.99] transition-transform cursor-pointer">
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 rounded-full bg-primary-tint text-primary text-xs font-semibold">{t(`home.categories.${order.category}`)}</span>
                      <div className="text-xs text-text-muted">📍 {Math.round((order.distance_m ?? 0) / 10) * 10}{t('master.meters')}</div>
                    </div>
                    <p className="text-sm font-semibold text-text-main line-clamp-2">{order.description}</p>
                    <p className="text-xs text-text-muted mt-1 truncate">📍 {order.address_text}</p>
                    <div className="flex items-center justify-between mt-3">
                      <p className="text-base font-extrabold text-slate-800">{order.is_negotiable ? t('master.negotiable') : `${order.price ?? 0} BYN`}</p>
                      {bidOrderIds.has(order.id) ? (
                        <span className="px-3 h-8 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-semibold flex items-center">{t('master.you_responded')}</span>
                      ) : (
                        <span className="px-3 h-8 rounded-xl bg-slate-900 text-white text-sm font-semibold flex items-center">{t('master.respond')}</span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          )}

          {tab === 'completed' && (
            <>
              <div className="flex items-center justify-between px-1 mb-2">
                <h2 className="text-lg font-bold text-text-main">{t('master.completed_heading')}</h2>
                <button onClick={loadCompleted} className="text-sm font-semibold text-primary">{t('master.refresh')}</button>
              </div>
              {completedLoading && <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-28 rounded-bento bg-white shadow-card animate-pulse" />)}</div>}
              {!completedLoading && completedOrders.length === 0 && <div className="text-center py-10 text-text-muted text-sm">{t('master.no_completed')}</div>}
              <div className="space-y-3">
                {completedOrders.map((order) => (
                  <div key={order.id} className="bg-white p-4 rounded-bento shadow-card opacity-70">
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">{t(`home.categories.${order.category}`)}</span>
                      <span className="text-[11px] text-slate-400">✅ {t('master.done')}</span>
                    </div>
                    <p className="text-sm font-semibold text-text-main line-clamp-2">{order.description}</p>
                    <p className="text-xs text-text-muted mt-1 truncate">📍 {order.address_text}</p>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                      <p className="text-base font-extrabold text-slate-800">{order.is_negotiable ? t('master.negotiable') : `${order.price ?? 0} BYN`}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {selectedId && (
          <motion.div className="fixed inset-0 z-[60] flex flex-col justify-end bg-slate-900/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={sheetTransition}>
            <motion.div
              className="flex max-h-[80vh] w-full max-w-[430px] mx-auto flex-col rounded-t-[24px] bg-white shadow-2xl"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={sheetTransition}
            >
              <div className="flex justify-center pt-3 pb-2 shrink-0">
                <div className="h-1 w-12 rounded-full bg-slate-300" />
              </div>
              <div className="px-5 pb-3 shrink-0">
                <h3 className="text-base font-semibold text-slate-800">{t('master.bid_title')}</h3>
              </div>
              {selected && (
                <div className="flex flex-col flex-1 min-h-0">
                  <div className="flex-1 overflow-y-auto px-5 space-y-4 pb-4">
                    <p className="text-sm text-slate-600">{selected.description}</p>
                    {!selected.is_negotiable && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{t('master.your_price')}</label>
                        <input type="number" inputMode="numeric" value={bidPrice} onChange={(e) => setBidPrice(e.target.value)} placeholder={String(selected.price ?? '')} className="w-full bg-slate-100 text-slate-800 placeholder-slate-400 rounded-xl p-4 border-transparent focus:ring-2 focus:ring-slate-400 focus:bg-white transition-all outline-none text-base" />
                      </div>
                    )}
                    {selected.is_negotiable && <p className="text-sm text-slate-500">{t('master.negotiable_desc')}</p>}
                  </div>
                  <div className="shrink-0 px-5 pb-[calc(24px+env(safe-area-inset-bottom,0px))] space-y-2 pt-4 border-t border-slate-100">
                    <button onClick={submitBid} disabled={submitting} className="w-full bg-slate-900 text-white rounded-xl py-4 font-semibold text-sm shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60">
                      {submitting ? t('master.sending') : t('master.send_bid')}
                    </button>
                    <button onClick={() => setSelectedId(null)} className="w-full py-3 rounded-xl text-sm font-semibold text-slate-500 active:bg-slate-100 transition-colors">
                      {t('master.cancel_bid')}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reviewSheet && (
          <motion.div className="fixed inset-0 z-[60] flex flex-col justify-end bg-slate-900/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={sheetTransition}>
            <motion.div
              className="flex max-h-[80vh] w-full max-w-[430px] mx-auto flex-col rounded-t-[24px] bg-white shadow-2xl"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={sheetTransition}
            >
              <div className="flex justify-center pt-3 pb-2 shrink-0">
                <div className="h-1 w-12 rounded-full bg-slate-300" />
              </div>
              <div className="px-5 pb-3 shrink-0">
                <h3 className="text-base font-semibold text-slate-800">{t('master.reviews_title')}</h3>
              </div>
              <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-4">
                {reviewsLoading && (
                  <div className="space-y-3">
                    {[0, 1, 2].map((i) => <div key={i} className="h-20 bg-slate-50 rounded-xl animate-pulse" />)}
                  </div>
                )}
                {!reviewsLoading && reviews.length === 0 && (
                  <p className="text-center py-8 text-sm text-slate-400">{t('master.no_reviews')}</p>
                )}
                {!reviewsLoading && reviews.map((r) => {
                  const stars = Array.from({ length: 5 }, (_, i) => i < r.rating ? '★' : '☆');
                  return (
                    <div key={r.id} className="bg-slate-50 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                          <Avatar size={32} src={r.client?.avatar_url ?? undefined} name={r.client?.full_name ?? r.client?.username ?? '?'} />
                          <span className="text-sm font-semibold text-slate-800">{r.client?.full_name ?? r.client?.username ?? t('master.anonymous')}</span>
                        </div>
                        <span className="text-[11px] text-slate-400">{new Date(r.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
                      </div>
                      <div className="text-amber-500 text-sm">{stars.join(' ')}</div>
                      {r.comment && <p className="text-sm text-slate-600 leading-relaxed">{r.comment}</p>}
                    </div>
                  );
                })}
              </div>
              <div className="shrink-0 px-5 pb-[calc(24px+env(safe-area-inset-bottom,0px))] pt-4 border-t border-slate-100">
                <button onClick={() => setReviewSheet(false)} className="w-full py-3 rounded-xl text-sm font-semibold text-slate-500 bg-slate-50 active:bg-slate-100 transition-colors">
                  {t('master.close')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
