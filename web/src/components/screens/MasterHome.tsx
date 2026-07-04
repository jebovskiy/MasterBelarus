import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/stores/auth';
import { useHaptic } from '@/hooks/useHaptic';
import { useLocation } from '@/hooks/useLocation';
import { Avatar } from '@/components/shared/Avatar';
import { apiPost, apiGet } from '@/lib/api';
import CitySelector, { type CityValue } from '@/components/shared/CitySelector';

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

function categoryEmoji(cat: string): string {
  const map: Record<string, string> = { plumber: '🔧', electrician: '⚡', mover: '📦', handyman: '🛠', tutor: '📚', cleaning: '🧹' };
  return map[cat] ?? '📋';
}

function formatPhone(phone?: string | null): string {
  if (!phone) return '+375 (29) XXX-XX-XX';
  const d = phone.replace(/\D/g, '').slice(-9);
  if (d.length < 9) return '+375 (29) XXX-XX-XX';
  return `+375 (29) ${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5, 7)}`;
}

export function MasterHome({ onNavigate }: { onNavigate?: (screen: string) => void }) {
  const profile = useAuthStore((s) => s.profile);
  const [orders, setOrders] = useState<NearbyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance] = useState<number>(15);
  const [rating] = useState<{ value: number; count: number }>({ value: 4.9, count: 87 });
  const [stats] = useState({ completed: 12, inProgress: 2, todayBids: 7 });
  const [filterCity, setFilterCity] = useState<CityValue | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bidPrice, setBidPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { impact, notification } = useHaptic();
  const { location } = useLocation();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        lat: String(location.latitude),
        lng: String(location.longitude),
        radius: '5000',
      });
      if (filterCity) params.set('city', filterCity.city);
      const result = await apiGet<any>(`/orders/nearby?${params}`);
      if ('data' in result && Array.isArray(result.data)) {
        setOrders(result.data);
      }
    } catch (e) {
      console.warn('[master] nearby failed', e);
    } finally {
      setLoading(false);
    }
  }, [location.latitude, location.longitude, filterCity]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const id = setInterval(load, 30000); return () => clearInterval(id); }, [load]);

  const openOrder = (order: NearbyOrder) => {
    setSelectedId(order.id);
    setBidPrice(order.is_negotiable ? '' : String(order.price ?? ''));
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
    if ('error' in result) {
      notification('error');
      console.warn('[bid] failed:', result.error);
      return;
    }
    notification('success');
    setSelectedId(null);
    setBidPrice('');
  };

  const selected = orders.find((o) => o.id === selectedId);

  return (
    <div className="min-h-screen bg-app-bg">
      <div className="px-4 pt-4 space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Avatar size={48} name={profile?.full_name ?? 'Мастер'} src={profile?.avatar_url ?? undefined} />
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-slate-800 truncate">{profile?.full_name ?? 'Мастер'}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-amber-500 text-xs">★</span>
                <span className="text-slate-600 text-xs font-semibold">{(profile?.avg_rating ?? 5.0).toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold">НПД</span>
                <span className="text-xs text-slate-500 font-medium">Связь: {formatPhone(profile?.phone)}</span>
              </div>
            </div>
            {balance !== null && <div className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">💎 {balance}</div>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 bg-white p-5 rounded-bento shadow-card">
            <p className="text-sm font-semibold text-text-muted">Баланс откликов</p>
            <p className="text-4xl font-extrabold text-primary mt-1">{balance ?? '—'}</p>
            <button onClick={() => onNavigate?.('wallet')} className="mt-2 text-sm font-semibold text-primary">Пополнить</button>
          </div>
          <div className="bg-white p-4 rounded-bento shadow-card flex flex-col justify-between">
            <p className="text-sm font-semibold text-text-muted">Рейтинг</p>
            <p className="text-2xl font-extrabold text-text-main mt-1">{rating ? `${rating.value} ★` : '—'}</p>
            <p className="text-xs text-text-muted">{rating ? `${rating.count} оценок` : ''}</p>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3 bg-white rounded-bento shadow-card text-xs text-text-muted font-medium">
          <span>✅ Выполнено <strong className="text-text-main">{stats.completed}</strong></span>
          <span className="text-app-border">|</span>
          <span>🔄 В работе <strong className="text-text-main">{stats.inProgress}</strong></span>
          <span className="text-app-border">|</span>
          <span>📊 Сегодня <strong className="text-primary">{stats.todayBids}</strong></span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Фильтр по городу</label>
            <CitySelector value={filterCity} onChange={setFilterCity} />
          </div>
          {filterCity && (
            <button
              onClick={() => setFilterCity(null)}
              className="mt-5 shrink-0 text-xs font-semibold text-rose-500 active:text-rose-600"
            >
              Сбросить
            </button>
          )}
        </div>

        <button onClick={() => onNavigate?.('edit_profile')} className="w-full bg-slate-900 text-white rounded-xl py-4 text-center text-sm font-semibold active:scale-[0.99] transition-transform">
          Редактировать анкету мастера
        </button>

        <div>
          <div className="flex items-center justify-between px-1 mb-2">
            <h2 className="text-lg font-bold text-text-main">Заказы рядом</h2>
            <button onClick={load} className="text-sm font-semibold text-primary">Обновить</button>
          </div>
          {loading && <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-32 rounded-bento bg-white shadow-card animate-pulse" />)}</div>}
          {!loading && orders.length === 0 && <div className="text-center py-10 text-text-muted text-sm">Пока нет заказов рядом</div>}
          <motion.div layout className="space-y-3">
            {orders.map((order, idx) => (
              <motion.div key={order.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 40 }} onClick={() => openOrder(order)} className="bg-white p-4 rounded-bento shadow-card active:scale-[0.99] transition-transform cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 rounded-full bg-primary-tint text-primary text-xs font-semibold">{categoryEmoji(order.category)} {order.category}</span>
                  <div className="text-xs text-text-muted">📍 {Math.round((order.distance_m ?? 0) / 10) * 10}м</div>
                </div>
                <p className="text-sm font-semibold text-text-main line-clamp-2">{order.description}</p>
                <p className="text-xs text-text-muted mt-1 truncate">📍 {order.address_text}</p>
                <div className="flex items-center justify-between mt-3">
                  <p className="text-base font-extrabold text-primary">{order.is_negotiable ? 'Договорная' : `${order.price ?? 0} BYN`}</p>
                  <span className="px-3 h-8 rounded-btn bg-primary text-white text-sm font-semibold">Откликнуться</span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {selectedId && (
          <motion.div className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div
              className="relative flex max-h-[70vh] w-full max-w-[430px] mx-auto flex-col rounded-t-[24px] bg-slate-50 shadow-2xl"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            >
              <div className="flex flex-col items-center py-3 border-b border-slate-100 bg-white rounded-t-[24px] shrink-0">
                <div className="h-1 w-12 rounded-full bg-slate-300 mb-2" />
                <h3 className="text-base font-semibold text-slate-800">Отклик на заказ</h3>
              </div>
              {selected && (
                <>
                  <div className="flex-1 overflow-y-auto px-5 pt-5 pb-32 space-y-4">
                    <p className="text-sm text-slate-600 line-clamp-2">{selected.description}</p>
                    {!selected.is_negotiable && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Ваша цена, BYN</label>
                        <input type="number" inputMode="numeric" value={bidPrice} onChange={(e) => setBidPrice(e.target.value)} placeholder={String(selected.price ?? '')} className="w-full bg-slate-100 text-slate-800 placeholder-slate-400 rounded-xl p-4 border-transparent focus:ring-2 focus:ring-slate-400 focus:bg-white transition-all outline-none text-base" />
                      </div>
                    )}
                    {selected.is_negotiable && <p className="text-sm text-slate-500">Договорная цена — предложите свои условия в комментарии.</p>}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent pt-8 pb-[calc(24px+env(safe-area-inset-bottom,0px))] px-5">
                    <button onClick={submitBid} disabled={submitting} className="w-full bg-slate-900 text-white rounded-xl py-4 font-semibold text-sm shadow-md active:scale-[0.98] transition-all disabled:opacity-60">
                      {submitting ? 'Отправляю...' : 'Отправить отклик'}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
