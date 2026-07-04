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
          <div key={order.id} onClick={() => onOpenOrder?.(order.id)} className="bg-white rounded-2xl shadow-sm p-4 hover:scale-[1.02] active:scale-[0.99] transition-transform cursor-pointer">
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
                className="px-4 py-2 rounded-xl bg-rose-50 text-rose-600 text-sm font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform"
              >
                Отменить
              </button>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {cancelTarget && (
          <motion.div className="fixed inset-0 z-[60] flex flex-col justify-end bg-slate-900/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div
              className="relative flex max-h-[70vh] w-full max-w-[430px] mx-auto flex-col rounded-t-[24px] bg-slate-50 shadow-2xl"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            >
              <div className="flex flex-col items-center py-3 border-b border-slate-100 bg-white rounded-t-[24px] shrink-0">
                <div className="h-1 w-12 rounded-full bg-slate-300 mb-2" />
                <h3 className="text-base font-semibold text-slate-800">Причина отмены</h3>
              </div>
              <div className="flex-1 overflow-y-auto px-5 pt-5 pb-32 space-y-2">
                <p className="text-sm text-slate-500 mb-4 line-clamp-2">{cancelTarget.description}</p>
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
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent pt-8 pb-[calc(24px+env(safe-area-inset-bottom,0px))] px-5">
                <button
                  onClick={() => setCancelTarget(null)}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-slate-500 bg-white shadow-sm active:bg-slate-50 transition-colors"
                >
                  Передумал
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
