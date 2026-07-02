import { useEffect, useState } from 'react';
import { useAdminStore, adminHeaders } from '@/stores/admin';

type AdminStats = { users: number; masters: number; orders: number; bids: number };
type AdminOrder = { id: string; category: string; status: string; price: number | null; created_at: string; client_id: string };
type AdminMaster = { id: string; full_name: string; username: string | null; role: string; is_npd: boolean; created_at: string; avg_rating: number | null; review_count: number };

export default function AdminDashboard({ onClose }: { onClose?: () => void }) {
  const token = useAdminStore((s) => s.token);
  const setToken = useAdminStore((s) => s.setToken);
  const clearToken = useAdminStore((s) => s.clear);
  const [inputToken, setInputToken] = useState('');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [masters, setMasters] = useState<AdminMaster[]>([]);
  const [tab, setTab] = useState<'stats' | 'orders' | 'masters'>('stats');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const fetchData = async () => {
      const h = adminHeaders(token);
      const fetchWithToken = async <T,>(path: string) => {
        const res = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}${path}`, { headers: { ...h } });
        return res.json() as T;
      };
      try {
        const [statsRes, ordersRes, mastersRes] = await Promise.all([
          fetchWithToken<AdminStats & { error?: string }>('/admin/stats'),
          fetchWithToken<AdminOrder[] & { error?: string }>('/admin/orders?limit=20'),
          fetchWithToken<AdminMaster[] & { error?: string }>('/admin/masters?limit=20'),
        ]);
        if ('error' in statsRes && statsRes.error) { setError(statsRes.error); return; }
        setStats(statsRes as AdminStats);
        setOrders(Array.isArray(ordersRes) ? ordersRes : []);
        setMasters(Array.isArray(mastersRes) ? mastersRes : []);
      } catch { setError('Failed to load admin data'); }
    };
    fetchData();
  }, [token]);

  if (!token) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4">
          <h1 className="text-xl font-bold text-white text-center">Админ-панель</h1>
          <p className="text-xs text-slate-400 text-center">Введите Admin Token для доступа</p>
          <input
            type="password"
            value={inputToken}
            onChange={(e) => setInputToken(e.target.value)}
            placeholder="Admin Token"
            className="w-full bg-slate-800 text-white rounded-xl p-4 text-sm border border-slate-700 outline-none focus:border-emerald-500"
          />
          <button onClick={() => { setToken(inputToken); setInputToken(''); }} disabled={!inputToken.trim()} className="w-full bg-emerald-600 text-white rounded-xl py-4 text-sm font-semibold disabled:opacity-50">
            Войти
          </button>
          {onClose && <button onClick={onClose} className="w-full text-slate-500 text-xs py-2">Отмена</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Панель администратора</h1>
        <div className="flex gap-3">
          {onClose && <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-300">Назад</button>}
          <button onClick={clearToken} className="text-xs text-red-400 hover:text-red-300">Выйти</button>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-800 rounded-xl p-1">
        {(['stats', 'orders', 'masters'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 text-xs py-2 rounded-lg font-semibold ${tab === t ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>
            {t === 'stats' ? 'Статистика' : t === 'orders' ? 'Заказы' : 'Мастера'}
          </button>
        ))}
      </div>

      {error && <p className="text-red-400 text-sm bg-red-900/30 p-3 rounded-xl">{error}</p>}

      {tab === 'stats' && stats && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Пользователи', value: stats.users },
            { label: 'Мастера', value: stats.masters },
            { label: 'Заказы', value: stats.orders },
            { label: 'Отклики', value: stats.bids },
          ].map((s) => (
            <div key={s.label} className="bg-slate-800 rounded-2xl p-5 text-center">
              <p className="text-3xl font-bold text-emerald-400">{s.value}</p>
              <p className="text-xs text-slate-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'orders' && (
        <div className="space-y-2">
          {orders.map((o) => (
            <div key={o.id} className="bg-slate-800 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono text-slate-400">{o.id.slice(0, 8)}…</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${o.status === 'open' ? 'bg-emerald-900 text-emerald-300' : o.status === 'completed' ? 'bg-blue-900 text-blue-300' : 'bg-amber-900 text-amber-300'}`}>{o.status}</span>
              </div>
              <p className="text-sm font-semibold">{o.category}</p>
              <p className="text-xs text-slate-400">{o.price ?? '—'} BYN</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'masters' && (
        <div className="space-y-2">
          {masters.map((m) => (
            <div key={m.id} className="bg-slate-800 rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{m.full_name}</p>
                <p className="text-xs text-slate-400">@{m.username ?? '—'} • {m.is_npd ? 'НПД' : 'Не НПД'}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-amber-400">{m.avg_rating ?? '—'} ★</p>
                <p className="text-xs text-slate-400">{m.review_count} отзывов</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
