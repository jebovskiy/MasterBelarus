import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHaptic } from '@/hooks/useHaptic';
import { apiGet, apiPost } from '@/lib/api';
import { MASTER_REASONS } from '@/data/cancel-reasons';

type InProgressOrder = {
  id: string;
  category: string;
  description: string;
  price: number | null;
  is_negotiable: boolean;
  address_text: string;
  created_at: string;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function MasterInProgress({ onOpenOrder }: { onOpenOrder?: (id: string) => void }) {
  const [orders, setOrders] = useState<InProgressOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<InProgressOrder | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { impact, notification } = useHaptic();

  const load = async () => {
    setLoading(true);
    const result = await apiGet<{ orders: InProgressOrder[] }>('/orders/in-progress');
    if ('data' in result && result.data) {
      setOrders(result.data.orders ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const handleCancel = async (reasonId: number) => {
    if (!cancelTarget) return;
    setSubmitting(true);
    impact('medium');
    const result = await apiPost(`/orders/${cancelTarget.id}/cancel`, {
      cancelled_by: 'master',
      cancellation_reason_id: reasonId,
    });
    setSubmitting(false);
    if ('error' in result) {
      notification('error');
      return;
    }
    notification('success');
    setCancelTarget(null);
    setOrders((prev) => prev.filter((o) => o.id !== cancelTarget.id));
  };

  if (loading) {
    return (
      <div className="px-4 pt-4 space-y-3">
        {[0, 1].map((i) => (
          <div key={i} className="h-28 bg-white rounded-2xl shadow-sm animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="px-4 pt-4">
      <h2 className="text-lg font-bold text-slate-800 mb-3">Заказы в работе</h2>
      {orders.length === 0 && (
        <div className="text-center py-10 text-slate-400 text-sm">Нет заказов в работе</div>
      )}
      <div className="space-y-3">
        {orders.map((order) => (
          <div key={order.id} onClick={() => onOpenOrder?.(order.id)} className="bg-white rounded-2xl shadow-sm p-4 active:scale-[0.99] transition-transform cursor-pointer">
            <div className="flex items-center justify-between mb-2">
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">{order.category}</span>
              <span className="text-[11px] text-slate-400">{formatDate(order.created_at)}</span>
            </div>
            <p className="text-sm font-semibold text-slate-800 line-clamp-2">{order.description}</p>
            <p className="text-xs text-slate-500 mt-1 truncate">{order.address_text}</p>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
              <p className="text-base font-extrabold text-slate-800">{order.is_negotiable ? 'Договорная' : `${order.price ?? 0} BYN`}</p>
              <button
                onClick={(e) => { e.stopPropagation(); impact('light'); setCancelTarget(order); }}
                className="px-4 py-2 rounded-xl bg-rose-50 text-rose-600 text-sm font-semibold active:scale-[0.98] transition-transform"
              >
                Отменить
              </button>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {cancelTarget && (
          <motion.div className="fixed inset-0 z-50 flex items-end justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCancelTarget(null)} />
            <motion.div
              className="relative w-full max-w-[430px] bg-white rounded-t-2xl shadow-lg shadow-slate-200/50 p-5 pb-8"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            >
              <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-300" />
              <h3 className="text-lg font-bold text-slate-800 mb-1">Причина отмены</h3>
              <p className="text-sm text-slate-500 mb-4 line-clamp-2">{cancelTarget.description}</p>
              <div className="space-y-2">
                {MASTER_REASONS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => void handleCancel(r.id)}
                    disabled={submitting}
                    className="w-full text-left px-4 py-3.5 rounded-xl text-sm font-medium text-slate-700 bg-[#f4f4f6] active:bg-slate-200 transition-colors disabled:opacity-60"
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCancelTarget(null)}
                className="w-full mt-3 py-3 rounded-xl text-sm font-semibold text-slate-500 active:bg-slate-50 transition-colors"
              >
                Передумал
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
