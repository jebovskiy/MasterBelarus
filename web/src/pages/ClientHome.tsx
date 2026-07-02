import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useHaptic } from '@/hooks/useHaptic';
import { useToastStore } from '@/components/shared/Toast';
import { apiGet } from '@/lib/api';

const CATEGORIES = [
  { key: 'plumber', label: 'Сантехник', icon: '🔧' },
  { key: 'electrician', label: 'Электрик', icon: '⚡' },
  { key: 'mover', label: 'Грузчик', icon: '📦' },
  { key: 'handyman', label: 'Муж на час', icon: '🛠' },
  { key: 'tutor', label: 'Репетитор', icon: '📚' },
  { key: 'cleaning', label: 'Уборка', icon: '🧹' },
];

type ClientOrder = {
  id: string;
  category: string;
  title: string;
  price: number | null;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  address: string;
  created_at: string;
};

type RecentMaster = {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  reviews: number;
  avatar: string | null;
  online: boolean;
};

const MOCK_ORDERS: ClientOrder[] = [
  { id: '1', category: 'plumber', title: 'Протечка под раковиной на кухне', price: 80, status: 'open', address: 'ул. Немига 5', created_at: new Date().toISOString() },
  { id: '2', category: 'electrician', title: 'Заменить розетку в спальне', price: 45, status: 'in_progress', address: 'пр-т Победителей 59', created_at: new Date(Date.now() - 7200000).toISOString() },
];

const MOCK_MASTERS: RecentMaster[] = [
  { id: 'm1', name: 'Алексей', specialty: 'Сантехник, Электрик', rating: 4.9, reviews: 87, avatar: null, online: true },
  { id: 'm2', name: 'Дмитрий', specialty: 'Муж на час', rating: 4.7, reviews: 34, avatar: null, online: true },
  { id: 'm3', name: 'Сергей', specialty: 'Электрик', rating: 5.0, reviews: 112, avatar: null, online: false },
  { id: 'm4', name: 'Иван', specialty: 'Грузчик, Сантехник', rating: 4.5, reviews: 23, avatar: null, online: true },
  { id: 'm5', name: 'Андрей', specialty: 'Уборка', rating: 4.8, reviews: 56, avatar: null, online: false },
];

type ClientHomeProps = {
  onOpenCreateOrder: (category?: string) => void;
  onOpenOrder?: (id: string) => void;
};

const EMOJI: Record<string, string> = { plumber: '🔧', electrician: '⚡', mover: '📦', handyman: '🛠', tutor: '📚', cleaning: '🧹' };

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'только что';
  if (diff < 60) return `${diff} мин`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `${h} ч`;
  return `${Math.floor(h / 24)} дн.`;
}

export default function ClientHome({ onOpenCreateOrder, onOpenOrder }: ClientHomeProps) {
  const { impact } = useHaptic();
  const showToast = useToastStore((s) => s.showToast);
  const [orders, setOrders] = useState<ClientOrder[]>([]);
  const [masters, setMasters] = useState<RecentMaster[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [mastersLoading, setMastersLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    try {
      const res = await apiGet<{ orders: ClientOrder[] }>('/orders/my');
      if ('data' in res && res.data?.orders) {
        setOrders(res.data.orders);
        return;
      }
    } catch { /* fallback */ }
    setOrders(MOCK_ORDERS);
  }, []);

  const loadMasters = useCallback(async () => {
    try {
      const res = await apiGet<{ masters: RecentMaster[] }>('/masters/recent');
      if ('data' in res && res.data?.masters) {
        setMasters(res.data.masters);
        return;
      }
    } catch { /* fallback */ }
    setMasters(MOCK_MASTERS);
  }, []);

  useEffect(() => { const done = async () => { await Promise.all([loadOrders(), loadMasters()]); setOrdersLoading(false); setMastersLoading(false); }; done(); }, [loadOrders, loadMasters]);

  const activeOrders = orders.filter((o) => o.status === 'open' || o.status === 'in_progress');

  return (
    <div className="min-h-screen bg-[#f4f4f6]">
      <div className="px-4 pt-4 space-y-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Бытовые услуги</p>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-1 leading-tight">Нужен мастер сегодня?</h1>
          <p className="text-[13px] text-slate-500 mt-1">Отклик за 5 минут</p>
          <div className="flex items-center justify-between mt-4">
            <button onClick={() => onOpenCreateOrder()} className="flex-1 h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold text-[15px] active:scale-[0.98] transition-all mr-3">+ Создать заявку</button>
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl shrink-0">🔨</div>
          </div>
        </div>

        {ordersLoading ? (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="h-4 w-24 bg-slate-200 rounded animate-pulse mb-3" />
            <div className="h-16 bg-slate-100 rounded-xl animate-pulse" />
          </div>
        ) : activeOrders.length > 0 ? (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-800 px-1">Активные заказы</h2>
            {activeOrders.map((order) => (
              <motion.button
                key={order.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => { impact('light'); onOpenOrder?.(order.id); }}
                className="w-full bg-white rounded-2xl p-4 shadow-sm text-left active:scale-[0.99] transition-transform border-l-[3px] border-emerald-500"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{EMOJI[order.category] ?? '📋'}</span>
                    <span className="text-sm font-semibold text-slate-800">{order.category === 'plumber' ? 'Сантехника' : order.category === 'electrician' ? 'Электрика' : order.category}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${order.status === 'in_progress' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    {order.status === 'in_progress' ? 'В работе' : 'Поиск мастера'}
                  </span>
                </div>
                <p className="text-sm text-slate-700 line-clamp-1">{order.title}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-slate-400">{timeAgo(order.created_at)}</span>
                  <span className="text-sm font-bold text-slate-800">{order.price ?? 0} BYN</span>
                </div>
              </motion.button>
            ))}
          </div>
        ) : null}

        <div>
          <h2 className="text-lg font-bold text-slate-800 px-1 mb-2">Популярные услуги</h2>
          <div className="grid grid-cols-2 gap-3">
            {CATEGORIES.map((cat) => (
              <button key={cat.key} onClick={() => { impact('light'); onOpenCreateOrder(cat.key); }} className="bg-white p-4 rounded-2xl shadow-sm h-24 flex flex-col justify-between active:scale-[0.98] transition-transform">
                <span className="text-2xl">{cat.icon}</span>
                <span className="text-sm font-semibold text-slate-800">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {mastersLoading ? (
          <div className="py-2">
            <div className="h-4 w-32 bg-slate-200 rounded animate-pulse mb-3" />
            <div className="flex gap-3 overflow-hidden">
              {[0, 1, 2].map((i) => <div key={i} className="w-44 h-28 bg-white rounded-2xl shadow-sm shrink-0 animate-pulse" />)}
            </div>
          </div>
        ) : masters.length > 0 ? (
          <div className="pb-2">
            <h2 className="text-lg font-bold text-slate-800 px-1 mb-2">Проверенные мастера</h2>
            <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-none pb-1" style={{ scrollbarWidth: 'none' }}>
              {masters.map((master) => (
                <motion.button
                  key={master.id}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => { impact('light'); showToast('Профиль мастера откроется в версии 1.1. Сейчас они получают заказы автоматически!', 'info'); }}
                  className="w-44 shrink-0 snap-start bg-white rounded-2xl p-4 shadow-sm text-left active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white ${master.online ? 'bg-emerald-500' : 'bg-slate-400'}`}>
                      {master.name[0]}
                    </div>
                    {master.online && <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />}
                  </div>
                  <p className="text-sm font-bold text-slate-800 truncate">{master.name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{master.specialty}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-amber-500 text-xs">★</span>
                    <span className="text-xs font-semibold text-slate-700">{master.rating}</span>
                    <span className="text-[10px] text-slate-400">({master.reviews})</span>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
