import { useEffect, useState } from 'react';
import { useAdminStore, adminHeaders } from '@/stores/admin';

type Tab = 'stats' | 'orders' | 'masters' | 'complaints';

type AdminStats = { users: number; masters: number; orders: number; bids: number };
type AdminOrder = { id: string; category: string; status: string; price: number | null; created_at: string; client_id: string };
type AdminMaster = { id: string; full_name: string; username: string | null; role: string; is_npd: boolean; created_at: string; avg_rating: number | null; review_count: number };

type Complaint = {
  id: string;
  userName: string;
  userRole: string;
  text: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
};

const TABS: { key: Tab; label: string }[] = [
  { key: 'stats', label: 'Статистика' },
  { key: 'orders', label: 'Заказы' },
  { key: 'masters', label: 'Мастера' },
  { key: 'complaints', label: 'Жалобы' },
];

const MOCK_COMPLAINTS: Complaint[] = [
  { id: '1', userName: 'Анна К.', userRole: 'Клиент', text: 'Не явился на заказ, игнорировал сообщения', date: '2 часа назад', status: 'pending' },
  { id: '2', userName: 'Сергей М.', userRole: 'Мастер', text: 'Необоснованная жалоба, клиент отказался платить', date: '1 день назад', status: 'pending' },
  { id: '3', userName: 'Елена П.', userRole: 'Клиент', text: 'Грубое поведение, некачественная работа', date: '3 дня назад', status: 'pending' },
  { id: '4', userName: 'Дмитрий В.', userRole: 'Клиент', text: 'Нарушение сроков, пропал после предоплаты', date: '1 неделя назад', status: 'pending' },
];

export default function AdminPanelView({ onClose }: { onClose?: () => void }) {
  const token = useAdminStore((s) => s.token);
  const setToken = useAdminStore((s) => s.setToken);
  const clearToken = useAdminStore((s) => s.clear);
  const isAdmin = useAdminStore((s) => s.isAdmin);
  const [inputToken, setInputToken] = useState('');
  const [tab, setTab] = useState<Tab>('stats');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [masters, setMasters] = useState<AdminMaster[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [complaints, setComplaints] = useState<Complaint[]>(MOCK_COMPLAINTS);

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

  const handleResolveComplaint = (id: string, resolution: 'approved' | 'rejected') => {
    setComplaints((prev) => prev.map((c) => (c.id === id ? { ...c, status: resolution } : c)));
  };

  if (!token || !isAdmin) {
    return (
      <div className="min-h-screen bg-[#F4F4F6] flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4">
          <h1 className="text-2xl font-bold text-slate-900 text-center">Администрирование</h1>
          <p className="text-xs text-slate-500 text-center">Введите Admin Token для доступа</p>
          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
            <input
              type="password"
              value={inputToken}
              onChange={(e) => setInputToken(e.target.value)}
              placeholder="Admin Token"
              className="w-full bg-[#F4F4F6] rounded-xl p-4 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-300 transition-shadow"
            />
            <button
              onClick={() => { setToken(inputToken); setInputToken(''); }}
              disabled={!inputToken.trim()}
              className="w-full bg-slate-900 text-white rounded-xl py-4 text-sm font-semibold disabled:opacity-50 active:scale-[0.97] transition-all"
            >
              Войти
            </button>
            {onClose && (
              <button onClick={onClose} className="w-full text-slate-500 text-xs py-2 active:scale-[0.97] transition-transform">
                Отмена
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F4F6] overflow-y-auto">
      <div className="sticky top-0 z-10 bg-[#F4F4F6] pt-3 px-4 pb-2">
        <div className="bg-white shadow-sm rounded-xl border border-slate-100 p-3 flex items-center justify-between">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 active:scale-[0.97] transition-transform"
          >
            <span className="text-slate-400 text-lg leading-none">←</span>
            <span>Назад</span>
          </button>
          <span className="text-sm font-bold text-slate-900">Администрирование</span>
          <button
            onClick={clearToken}
            className="text-xs font-medium text-rose-500 active:scale-[0.97] transition-transform"
          >
            Выйти
          </button>
        </div>
      </div>

      <div className="px-4 pb-4 space-y-4">
        <div className="bg-slate-100 rounded-xl p-1 flex">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 text-center text-xs py-2.5 rounded-lg transition-all ${
                  active
                    ? 'bg-white text-slate-800 font-semibold shadow-sm'
                    : 'text-slate-500 font-medium'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="bg-rose-50 rounded-2xl p-4">
            <p className="text-rose-600 text-sm font-medium">{error}</p>
          </div>
        )}

        {tab === 'stats' && stats && (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Пользователи', value: stats.users },
              { label: 'Мастера', value: stats.masters },
              { label: 'Заказы', value: stats.orders },
              { label: 'Отклики', value: stats.bids },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm text-center active:scale-[0.98] transition-transform">
                <p className="text-3xl font-bold text-slate-900">{s.value}</p>
                <p className="text-xs text-slate-500 mt-1 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'orders' && (
          <div className="space-y-3">
            {orders.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">Нет заказов</p>
            )}
            {orders.map((o) => (
              <div key={o.id} className="bg-white rounded-2xl p-5 shadow-sm space-y-2 active:scale-[0.98] transition-transform">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-400">{o.id.slice(0, 8)}…</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                    o.status === 'open' ? 'bg-emerald-50 text-emerald-700' :
                    o.status === 'completed' ? 'bg-blue-50 text-blue-700' :
                    'bg-amber-50 text-amber-700'
                  }`}>
                    {o.status === 'open' ? 'Открыт' : o.status === 'completed' ? 'Завершён' : 'В работе'}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-900">{o.category}</p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">{o.price ?? '—'} BYN</p>
                  <p className="text-[10px] text-slate-400">{new Date(o.created_at).toLocaleDateString('ru-RU')}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'masters' && (
          <div className="space-y-3">
            {masters.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">Нет мастеров</p>
            )}
            {masters.map((m) => (
              <div key={m.id} className="bg-white rounded-2xl p-5 shadow-sm active:scale-[0.98] transition-transform">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{m.full_name}</p>
                    <p className="text-xs text-slate-400">@{m.username ?? '—'}</p>
                  </div>
                  <div className="text-right ml-3">
                    <p className="text-sm font-bold text-amber-600">{m.avg_rating ?? '—'} ★</p>
                    <p className="text-[10px] text-slate-400">{m.review_count} отзывов</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    m.is_npd ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {m.is_npd ? 'НПД' : 'Не НПД'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    с {new Date(m.created_at).toLocaleDateString('ru-RU')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'complaints' && (
          <div className="space-y-3">
            {complaints.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">Нет жалоб</p>
            )}
            {complaints.map((c) => (
              <div key={c.id} className="bg-white rounded-2xl p-5 shadow-sm space-y-3 active:scale-[0.98] transition-transform">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{c.userName}</span>
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      {c.userRole}
                    </span>
                    <span className="text-[10px] text-slate-400">{c.date}</span>
                  </div>
                  {c.status !== 'pending' && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      c.status === 'approved' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {c.status === 'approved' ? 'Заблокирован' : 'Отклонена'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{c.text}</p>
                {c.status === 'pending' && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleResolveComplaint(c.id, 'rejected')}
                      className="flex-1 bg-slate-100 text-slate-800 rounded-xl py-2.5 text-xs font-semibold active:scale-[0.97] transition-all"
                    >
                      Отклонить
                    </button>
                    <button
                      onClick={() => handleResolveComplaint(c.id, 'approved')}
                      className="flex-1 bg-rose-50 text-rose-600 rounded-xl py-2.5 text-xs font-semibold active:scale-[0.97] transition-all"
                    >
                      Заблокировать
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
