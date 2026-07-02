import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { apiGet, apiPatch } from '@/lib/api';

type Stat = { users: number; masters: number; orders: number; bids: number };
type AdminOrder = { id: string; category: string; status: string; price: number | null; created_at: string };
type AdminMaster = { id: string; full_name: string | null; username: string | null; role: string; is_npd: boolean; created_at: string; avg_rating: number | null; review_count: number };

type Tab = 'stats' | 'orders' | 'masters';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'stats', label: 'Статистика', icon: '📊' },
  { key: 'orders', label: 'Заказы', icon: '📋' },
  { key: 'masters', label: 'Мастера', icon: '👷' },
];

export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>('stats');
  const [stats, setStats] = useState<Stat | null>(null);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [masters, setMasters] = useState<AdminMaster[]>([]);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      if (tab === 'stats') {
        const r = await apiGet<Stat>('/admin/stats');
        if ('data' in r && r.data) setStats(r.data);
      } else if (tab === 'orders') {
        const r = await apiGet<AdminOrder[]>('/admin/orders');
        if ('data' in r && r.data) setOrders(r.data);
      } else if (tab === 'masters') {
        const r = await apiGet<AdminMaster[]>('/admin/masters');
        if ('data' in r && r.data) setMasters(r.data);
      }
    } finally {
      setLoading(false);
    }
  }, [tab, token]);

  useEffect(() => { void load(); }, [load]);

  const changeOrderStatus = async (orderId: string, status: string) => {
    await apiPatch(`/admin/orders/${orderId}/status`, { status });
    await load();
  };

  return (
    <div className="min-h-screen bg-app-bg pb-24">
      <div className="px-4 pt-4">
        <h1 className="text-xl font-extrabold text-text-main mb-4">🛡️ Админ-панель</h1>

        {!token && (
          <div className="mb-4">
            <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Admin token" className="w-full rounded-btn border border-app-border bg-white p-3 text-sm" />
            <p className="text-xs text-text-muted mt-1">Введите ADMIN_TOKEN для доступа</p>
          </div>
        )}

        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-1.5 px-4 h-9 rounded-full text-sm font-semibold whitespace-nowrap transition ${tab === t.key ? 'bg-primary-tint text-primary' : 'bg-white text-text-muted border border-app-border'}`}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        {loading && <div className="text-sm text-text-muted">Загрузка...</div>}

        {tab === 'stats' && stats && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 gap-3">
            {[{ label: 'Пользователи', value: stats.users }, { label: 'Мастера', value: stats.masters }, { label: 'Заказы', value: stats.orders }, { label: 'Отклики', value: stats.bids }].map((item) => (
              <div key={item.label} className="bg-white p-4 rounded-bento shadow-card">
                <p className="text-xs text-text-muted font-semibold">{item.label}</p>
                <p className="text-3xl font-extrabold text-primary mt-1">{item.value}</p>
              </div>
            ))}
          </motion.div>
        )}

        {tab === 'orders' && (
          <div className="space-y-3">
            {orders.map((order) => (
              <div key={order.id} className="bg-white p-4 rounded-bento shadow-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-text-main">{order.category}</span>
                  <span className="text-xs text-text-muted">{new Date(order.created_at).toLocaleDateString('ru-RU')}</span>
                </div>
                <p className="text-xs text-text-muted mb-2">#{order.id.slice(0, 8)}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-primary">{order.price ? `${order.price} BYN` : 'Договорная'}</span>
                  <select value={order.status} onChange={(e) => changeOrderStatus(order.id, e.target.value)} className="rounded-btn border border-app-border bg-white px-2 py-1 text-xs">
                    <option value="open">Открыт</option>
                    <option value="in_progress">В работе</option>
                    <option value="completed">Завершён</option>
                    <option value="cancelled">Отменён</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'masters' && (
          <div className="space-y-3">
            {masters.map((m) => (
              <div key={m.id} className="bg-white p-4 rounded-bento shadow-card">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-bold text-text-main">{m.full_name ?? m.username ?? 'Без имени'}</p>
                  {m.is_npd && <span className="px-2 py-0.5 rounded-full bg-success-tint text-success text-[10px] font-bold">НПД</span>}
                </div>
                <p className="text-xs text-text-muted">{m.avg_rating ? `★ ${m.avg_rating} (${m.review_count})` : 'Нет оценок'}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
