import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { apiGet } from '@/lib/api';
import { useToastStore } from '@/components/shared/Toast';

type Tab = 'active' | 'archive';

type OrderItem = {
  id: string;
  category: string;
  title?: string;
  description: string;
  price: number | null;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  address_text: string;
  created_at: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  plumber: 'Сантехника', electrician: 'Электрика', mover: 'Грузчик',
  handyman: 'Муж на час', tutor: 'Репетитор', cleaning: 'Уборка',
};

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  open: { label: 'В поиске', cls: 'bg-amber-50 text-amber-700' },
  in_progress: { label: 'В работе', cls: 'bg-blue-50 text-blue-700' },
  completed: { label: 'Выполнен', cls: 'bg-emerald-50 text-emerald-700' },
  cancelled: { label: 'Отменён', cls: 'bg-rose-50 text-rose-600' },
};

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'только что';
  if (diff < 60) return `${diff} мин`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `${h} ч`;
  return `${Math.floor(h / 24)} дн.`;
}

type Props = { onBack: () => void; onOpenOrder?: (id: string) => void };

export default function OrderHistoryScreen({ onBack, onOpenOrder }: Props) {
  const [tab, setTab] = useState<Tab>('active');
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const showToast = useToastStore((s) => s.showToast);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiGet<{ orders: OrderItem[] }>('/orders/my');
      if ('data' in result && result.data?.orders) {
        setOrders(result.data.orders);
        setLoading(false);
        return;
      }
    } catch { /* fallback */ }
    setOrders([]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const activeOrders = orders.filter((o) => o.status === 'open' || o.status === 'in_progress');
  const archiveOrders = orders.filter((o) => o.status === 'completed' || o.status === 'cancelled');
  const displayed = tab === 'active' ? activeOrders : archiveOrders;

  return (
    <div className="min-h-dvh bg-[#f4f4f6] flex flex-col">
      <div className="flex items-center gap-3 px-4 pt-4 pb-2 shrink-0">
        <button onClick={onBack} className="text-slate-600 text-sm font-medium">← Назад</button>
        <h1 className="text-lg font-bold text-slate-900">История заказов</h1>
      </div>

      <div className="flex-1 px-4 space-y-4 overflow-y-auto pb-[calc(16px+env(safe-area-inset-bottom,0px))]">

        <div className="bg-slate-100 rounded-xl p-1 flex w-full">
          {([
            { key: 'active' as Tab, label: `Активные (${activeOrders.length})` },
            { key: 'archive' as Tab, label: `Архив (${archiveOrders.length})` },
          ]).map(({ key, label }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 text-center text-xs py-2.5 rounded-lg transition-all ${
                  active ? 'bg-white text-slate-800 font-semibold shadow-sm' : 'text-slate-500 font-medium'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-5 shadow-sm animate-pulse space-y-2">
                <div className="h-4 w-24 bg-slate-200 rounded" />
                <div className="h-3 w-full bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 text-sm text-slate-400">
            {tab === 'active' ? 'Нет активных заказов' : 'Архив пуст'}
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map((order, idx) => {
              const statusInfo = STATUS_MAP[order.status] ?? { label: order.status, cls: 'bg-slate-50 text-slate-600' };
              const isActive = order.status === 'open' || order.status === 'in_progress';
              return (
                <motion.button
                  key={order.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  onClick={() => {
                    if (isActive && onOpenOrder) onOpenOrder(order.id);
                    else showToast('Заказ завершён. Детали доступны в архиве', 'info');
                  }}
                  className="w-full bg-white rounded-2xl p-5 shadow-sm text-left active:scale-[0.99] transition-transform"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-slate-800">
                      {CATEGORY_LABELS[order.category] ?? order.category}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusInfo.cls}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-1">{order.description}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-slate-400">{timeAgo(order.created_at)}</span>
                    <span className="text-sm font-bold text-slate-800">{order.price ?? 0} BYN</span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
