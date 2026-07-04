import { useEffect, useState } from 'react';
import { useAdminStore, adminHeaders } from '@/stores/admin';
import { useToastStore } from '@/components/shared/Toast';

type Tab = 'stats' | 'orders' | 'masters' | 'moderation' | 'complaints';

type AdminStats = { users: number; masters: number; orders: number; bids: number };
type AdminOrder = { id: string; category: string; status: string; price: number | null; created_at: string; client_id: string };
type AdminMaster = { id: string; full_name: string; username: string | null; role: string; is_npd: boolean; created_at: string; avg_rating: number | null; review_count: number };

type PendingMaster = {
  id: string;
  telegram_id: number;
  full_name: string;
  phone: string;
  username: string | null;
  city: string;
  category: string | null;
  master_status: string;
  created_at: string;
};

type Complaint = {
  id: string;
  user_name: string;
  user_role: string;
  text: string;
  created_at: string;
  status: 'pending' | 'approved' | 'rejected';
};

const TABS: { key: Tab; label: string }[] = [
  { key: 'stats', label: 'Статистика' },
  { key: 'orders', label: 'Заказы' },
  { key: 'masters', label: 'Мастера' },
  { key: 'moderation', label: 'Модерация' },
  { key: 'complaints', label: 'Жалобы' },
];

const MOCK_COMPLAINTS: Complaint[] = [];

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'только что';
  if (diff < 60) return `${diff} мин.`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `${h} ч.`;
  return `${Math.floor(h / 24)} дн.`;
}

export default function AdminPanelView({ onClose }: { onClose?: () => void }) {
  const isAdmin = useAdminStore((s) => s.isAdmin);
  const checking = useAdminStore((s) => s.checking);
  const setTelegramAdmin = useAdminStore((s) => s.setTelegramAdmin);
  const clear = useAdminStore((s) => s.clear);
  const setChecking = useAdminStore((s) => s.setChecking);
  const showToast = useToastStore((s) => s.showToast);
  const [tab, setTab] = useState<Tab>('stats');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [masters, setMasters] = useState<AdminMaster[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [complaints, setComplaints] = useState<Complaint[]>(MOCK_COMPLAINTS);

  const [pendingMasters, setPendingMasters] = useState<PendingMaster[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isAdmin) { setChecking(false); return; }
    const initData = adminHeaders();
    if (!initData['x-telegram-init-data']) { setChecking(false); return; }
    fetch(`${API_BASE}/admin/stats`, { headers: initData })
      .then((r) => { if (r.ok) setTelegramAdmin(); })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [isAdmin, setTelegramAdmin, setChecking]);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchData = async () => {
      const h = adminHeaders();
      const fetchWithToken = async <T,>(path: string) => {
        const res = await fetch(`${API_BASE}${path}`, { headers: { ...h } });
        return res.json() as T;
      };
      try {
        const [statsRes, ordersRes, mastersRes, complaintsRes] = await Promise.all([
          fetchWithToken<AdminStats & { error?: string }>('/admin/stats'),
          fetchWithToken<AdminOrder[] & { error?: string }>('/admin/orders?limit=20'),
          fetchWithToken<AdminMaster[] & { error?: string }>('/admin/masters?limit=20'),
          fetchWithToken<Complaint[] & { error?: string }>('/admin/complaints'),
        ]);
        if ('error' in statsRes && statsRes.error) { setError(statsRes.error); return; }
        setStats(statsRes as AdminStats);
        setOrders(Array.isArray(ordersRes) ? ordersRes : []);
        setMasters(Array.isArray(mastersRes) ? mastersRes : []);
        setComplaints(Array.isArray(complaintsRes) ? complaintsRes : []);
      } catch { setError('Failed to load admin data'); }
    };
    fetchData();
  }, [isAdmin]);

  const fetchPendingMasters = async () => {
    if (!isAdmin) return;
    setLoadingPending(true);
    const h = adminHeaders();
    try {
      const res = await fetch(`${API_BASE}/admin/masters/pending`, { headers: { ...h } });
      const data = await res.json() as PendingMaster[];
      setPendingMasters(Array.isArray(data) ? data : []);
    } catch {
      showToast('Не удалось загрузить заявки', 'error');
    } finally {
      setLoadingPending(false);
    }
  };

  useEffect(() => {
    if (tab === 'moderation' && isAdmin) {
      fetchPendingMasters();
    }
  }, [tab, isAdmin]);

  const handleModerate = async (tgId: number, action: 'approve' | 'reject') => {
    const key = `${tgId}_${action}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const h = adminHeaders();
      const res = await fetch(`${API_BASE}/admin/masters/${action}/${tgId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...h },
        body: '{}',
      });
      if (!res.ok) throw new Error('request failed');
      setPendingMasters((prev) => prev.filter((m) => m.telegram_id !== tgId));
      if (action === 'approve') {
        showToast('Мастер успешно верифицирован!', 'success');
      } else {
        showToast('Заявка мастера отклонена', 'warning');
      }
    } catch {
      showToast('Ошибка выполнения операции', 'error');
    } finally {
      setActionLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleResolveComplaint = async (id: string, status: 'approved' | 'rejected') => {
    const h = adminHeaders();
    try {
      const res = await fetch(`${API_BASE}/admin/complaints/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...h },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      setComplaints((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
      showToast(status === 'approved' ? 'Пользователь заблокирован' : 'Жалоба отклонена', 'success');
    } catch {
      showToast('Ошибка при обработке жалобы', 'error');
    }
  };

  if (!isAdmin) {
    if (checking) {
      return (
        <div className="min-h-screen bg-[#F4F4F6] flex items-center justify-center p-6">
          <p className="text-sm text-slate-400">Проверка доступа...</p>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-[#F4F4F6] flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4">
          <h1 className="text-2xl font-bold text-slate-900 text-center">Администрирование</h1>
          <p className="text-xs text-slate-500 text-center">Доступ только для администраторов Telegram</p>
          {onClose && (
            <button onClick={onClose} className="w-full text-slate-500 text-xs py-2 hover:scale-[1.02] active:scale-[0.97] transition-transform">
              Отмена
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#F4F4F6] overflow-y-auto">
      <div className="sticky top-0 z-10 bg-[#F4F4F6] pt-3 px-4 pb-2">
        <div className="bg-white shadow-sm rounded-xl border border-slate-100 p-3 flex items-center justify-between">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:scale-[1.02] active:scale-[0.97] transition-transform"
          >
            <span className="text-slate-400 text-lg leading-none">←</span>
            <span>Назад</span>
          </button>
          <span className="text-sm font-bold text-slate-900">Администрирование</span>
          <button
            onClick={clear}
            className="text-xs font-medium text-rose-500 hover:scale-[1.02] active:scale-[0.97] transition-transform"
          >
            Выйти
          </button>
        </div>
      </div>

      <div className="px-4 pb-24 space-y-4">
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
              <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm text-center hover:scale-[1.02] active:scale-[0.98] transition-transform">
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
              <div key={o.id} className="bg-white rounded-2xl p-5 shadow-sm space-y-2 hover:scale-[1.02] active:scale-[0.98] transition-transform">
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
              <div key={m.id} className="bg-white rounded-2xl p-5 shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-transform">
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

        {tab === 'moderation' && (
          <div className="space-y-4">
            {loadingPending && <p className="text-sm text-slate-400 text-center py-8">Загрузка...</p>}

            {!loadingPending && pendingMasters.length === 0 && (
              <div className="bg-white rounded-2xl p-8 shadow-sm text-center space-y-3">
                <span className="text-3xl block">🎉</span>
                <p className="text-sm font-semibold text-slate-800">Все заявки разобраны!</p>
                <p className="text-xs text-slate-400">Новых мастеров пока нет</p>
              </div>
            )}

            {pendingMasters.map((m) => {
              const isApproving = actionLoading[`${m.telegram_id}_approve`] ?? false;
              const isRejecting = actionLoading[`${m.telegram_id}_reject`] ?? false;
              const disabled = isApproving || isRejecting;

              return (
                <div
                  key={m.telegram_id}
                  className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:scale-[1.02] active:scale-[0.98] transition-all duration-180"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-semibold text-slate-900 text-base">{m.full_name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">TG ID: {m.telegram_id}</p>
                    </div>
                    <span className="bg-amber-50 text-amber-700 text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap">
                      Ожидает проверки
                    </span>
                  </div>

                  <div className="space-y-1.5 my-4 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <span>📞</span>
                      <span className="font-medium">{m.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>📍</span>
                      <span>{m.city}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>🛠</span>
                      <span className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-md">{m.category ?? '—'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <button
                      onClick={() => handleModerate(m.telegram_id, 'reject')}
                      disabled={disabled}
                      className="w-full bg-rose-50 text-rose-600 font-medium py-3 rounded-xl text-sm hover:scale-[1.02] active:scale-[0.97] transition-transform duration-180 disabled:opacity-50 disabled:active:scale-100"
                    >
                      ❌ Отклонить
                    </button>
                    <button
                      onClick={() => handleModerate(m.telegram_id, 'approve')}
                      disabled={disabled}
                      className="w-full bg-slate-900 text-white font-medium py-3 rounded-xl text-sm hover:scale-[1.02] active:scale-[0.97] transition-transform duration-180 disabled:opacity-50 disabled:active:scale-100"
                    >
                      ✅ Одобрить
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'complaints' && (
          <div className="space-y-3">
            {complaints.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">Нет жалоб</p>
            )}
            {complaints.map((c) => (
              <div key={c.id} className="bg-white rounded-2xl p-5 shadow-sm space-y-3 hover:scale-[1.02] active:scale-[0.98] transition-transform">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{c.user_name}</span>
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      {c.user_role}
                    </span>
                    <span className="text-[10px] text-slate-400">{timeAgo(c.created_at)}</span>
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
                      className="flex-1 bg-slate-100 text-slate-800 rounded-xl py-2.5 text-xs font-semibold hover:scale-[1.02] active:scale-[0.97] transition-all"
                    >
                      Отклонить
                    </button>
                    <button
                      onClick={() => handleResolveComplaint(c.id, 'approved')}
                      className="flex-1 bg-rose-50 text-rose-600 rounded-xl py-2.5 text-xs font-semibold hover:scale-[1.02] active:scale-[0.97] transition-all"
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
