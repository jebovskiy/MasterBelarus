import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useHaptic } from '@/hooks/useHaptic';
import { apiPost, apiGet } from '@/lib/api';

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

type MasterHomeProps = {
  onOpenOrder: (order: NearbyOrder) => void;
};

function categoryEmoji(cat: string): string {
  const map: Record<string, string> = {
    plumber: '🔧',
    electrician: '⚡',
    mover: '📦',
    handyman: '🛠',
    tutor: '📚',
    cleaning: '🧹',
  };
  return map[cat] ?? '📋';
}

export default function MasterHome({ onOpenOrder }: MasterHomeProps) {
  const [orders, setOrders] = useState<NearbyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<number | null>(null);
  const [rating, setRating] = useState<{ value: number; count: number } | null>(null);
  const [stats, setStats] = useState({ completed: 0, inProgress: 0, today: 0 });
  const { impact } = useHaptic();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiGet<{ data: NearbyOrder[] }>('/orders/nearby?lat=53.9&lng=27.5667&radius=5000');
      if ('data' in result) setOrders(result.data);
    } catch (e) {
      console.warn('[master] nearby failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="min-h-screen bg-app-bg pb-24">
      <div className="px-4 pt-4 space-y-4">
        {/* Status banner */}
        <div className="bg-gradient-to-br from-primary-tint to-app-bg p-4 rounded-bento">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-2xl shadow-card">
              👷
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-text-main">Мастер</p>
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-success-tint text-success text-xs font-semibold">
                Статус: НПД Активен
              </span>
            </div>
            {balance !== null && (
              <div className="px-2.5 py-1 rounded-full bg-primary-tint text-primary text-xs font-bold">
                💎 {balance}
              </div>
            )}
          </div>
        </div>

        {/* Stats bento */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 bg-white p-5 rounded-bento shadow-card">
            <p className="text-sm font-semibold text-text-muted">Баланс откликов</p>
            <p className="text-4xl font-extrabold text-primary mt-1">
              {balance ?? '—'}
            </p>
            <button
              onClick={() => impact('light')}
              className="mt-2 text-sm font-semibold text-primary"
            >
              Пополнить
            </button>
          </div>
          <div className="bg-white p-4 rounded-bento shadow-card flex flex-col justify-between">
            <p className="text-sm font-semibold text-text-muted">Рейтинг</p>
            <p className="text-2xl font-extrabold text-text-main mt-1">
              {rating ? `${rating.value} ★` : '—'}
            </p>
            <p className="text-xs text-text-muted">{rating ? `${rating.count} оценок` : ''}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Выполнено', value: stats.completed },
            { label: 'В работе', value: stats.inProgress },
            { label: 'Откликов сегодня', value: stats.today },
          ].map((item) => (
            <div key={item.label} className="bg-white p-3 rounded-bento shadow-card text-center">
              <p className="text-xl font-extrabold text-text-main">{item.value}</p>
              <p className="text-[11px] text-text-muted mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Live orders */}
        <div>
          <div className="flex items-center justify-between px-1 mb-2">
            <h2 className="text-lg font-bold text-text-main">Заказы рядом</h2>
            <button onClick={load} className="text-sm font-semibold text-primary">
              Обновить
            </button>
          </div>

          {loading && (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-32 rounded-bento bg-white shadow-card animate-pulse" />
              ))}
            </div>
          )}

          {!loading && orders.length === 0 && (
            <div className="text-center py-10 text-text-muted text-sm">
              Пока нет заказов рядом
            </div>
          )}

          <motion.div layout className="space-y-3">
            {orders.map((order, idx) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 40 }}
                onClick={() => onOpenOrder(order)}
                className="bg-white p-4 rounded-bento shadow-card active:scale-[0.99] transition-transform cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 rounded-full bg-primary-tint text-primary text-xs font-semibold">
                    {categoryEmoji(order.category)} {order.category}
                  </span>
                  <div className="text-xs text-text-muted">
                    📍 {Math.round((order.distance_m ?? 0) / 10) * 10}м
                  </div>
                </div>
                <p className="text-sm font-semibold text-text-main line-clamp-2">{order.description}</p>
                <p className="text-xs text-text-muted mt-1 truncate">📍 {order.address_text}</p>
                <div className="flex items-center justify-between mt-3">
                  <p className="text-base font-extrabold text-primary">
                    {order.is_negotiable ? 'Договорная' : `${order.price ?? 0} BYN`}
                  </p>
                  <span className="px-3 h-8 rounded-btn bg-primary text-white text-sm font-semibold">
                    Откликнуться
                  </span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// Small helper to satisfy `apiGet` expecting a class-style interface.
export const apiGet = async <T>(path: string): Promise<T> => {
  const initData = typeof window !== 'undefined' && window.Telegram?.WebApp?.initData
    ? window.Telegram.WebApp.initData
    : '';

  const res = await fetch(`http://localhost:3000${path}`, {
    headers: {
      ...(initData ? { 'x-telegram-init-data': initData } : {}),
    },
  });

  return res.json() as Promise<T>;
};
