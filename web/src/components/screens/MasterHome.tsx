import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHaptic } from '@/hooks/useHaptic';
import { useLocation } from '@/hooks/useLocation';
import { apiPost, apiGet } from '@/lib/api';
import { useToast } from '@/components/shared/Toast';

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

export function MasterHome() {
  const [orders, setOrders] = useState<NearbyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance] = useState<number>(15);
  const [rating] = useState<{ value: number; count: number }>({ value: 4.9, count: 87 });
  const [stats] = useState({ completed: 12, inProgress: 2, todayBids: 7 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bidPrice, setBidPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { impact, notification } = useHaptic();
  const toast = useToast();
  const { location } = useLocation();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiGet<any>(`/orders/nearby?lat=${location.latitude}&lng=${location.longitude}&radius=5000`);
      if ('data' in result && Array.isArray(result.data)) {
        setOrders(result.data);
      }
    } catch (e) {
      console.warn('[master] nearby failed', e);
    } finally {
      setLoading(false);
    }
  }, [location.latitude, location.longitude]);

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
        <div className="bg-gradient-to-br from-primary-tint to-app-bg p-4 rounded-bento">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-2xl shadow-card">👷</div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-text-main">Мастер</p>
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-success-tint text-success text-xs font-semibold">Статус: НПД Активен</span>
            </div>
            {balance !== null && <div className="px-2.5 py-1 rounded-full bg-primary-tint text-primary text-xs font-bold">💎 {balance}</div>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 bg-white p-5 rounded-bento shadow-card">
            <p className="text-sm font-semibold text-text-muted">Баланс откликов</p>
            <p className="text-4xl font-extrabold text-primary mt-1">{balance ?? '—'}</p>
            <button onClick={() => toast.show('info', '💎 Пополнение', 'Запустится после завершения бета-теста')} className="mt-2 text-sm font-semibold text-primary">Пополнить</button>
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
          <motion.div className="fixed inset-0 z-50 flex items-end justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedId(null)} />
            <motion.div className="relative w-full max-w-[430px] bg-app-surface rounded-t-3xl p-5 pb-8 shadow-modal" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 260 }}>
              <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-app-border" />
              {selected && (
                <>
                  <h3 className="text-lg font-bold text-text-main mb-1">Отклик на заказ</h3>
                  <p className="text-sm text-text-muted mb-4 line-clamp-2">{selected.description}</p>
                  {!selected.is_negotiable && (
                    <div className="mb-4">
                      <label className="block text-sm font-semibold text-text-main mb-1.5">Ваша цена, BYN</label>
                      <input type="number" inputMode="numeric" value={bidPrice} onChange={(e) => setBidPrice(e.target.value)} placeholder={String(selected.price ?? '')} className="w-full rounded-btn border border-app-border bg-white p-3 text-[15px] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition" />
                    </div>
                  )}
                  {selected.is_negotiable && <p className="text-sm text-text-muted mb-4">Договорная цена — предложите свои условия в комментарии.</p>}
                  <button onClick={submitBid} disabled={submitting} className="w-full h-12 rounded-btn bg-primary hover:bg-primary-hover text-white font-semibold shadow-accent-glow transition-all duration-180 disabled:opacity-60 active:scale-[0.98]">
                    {submitting ? 'Отправляю...' : 'Отправить отклик'}
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
