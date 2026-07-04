import { useEffect, useRef } from 'react';
import { getStartParam } from '@/lib/telegram';
import { apiPost } from '@/lib/api';
import { useToastStore } from '@/components/shared/Toast';
import { useHaptic } from '@/hooks/useHaptic';

export function useStartAppHandler() {
  const showToast = useToastStore((s) => s.showToast);
  const { notification } = useHaptic();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const param = getStartParam();
    if (!param) return;

    if (param.startsWith('reactive_order_')) {
      const orderId = param.replace('reactive_order_', '');
      const confirmed = window.confirm('🔄 Вернуть отменённый заказ в поиск?\n\nЗаказ снова увидят мастера, и вы сможете выбрать нового исполнителя.');
      if (!confirmed) return;

      apiPost(`/orders/${orderId}/reactivate`, {}).then((res) => {
        if ('error' in res) {
          notification('error');
          showToast('Ошибка при восстановлении заказа', 'error');
          return;
        }
        notification('success');
        showToast('✅ Заказ снова открыт! Мастера могут откликаться.', 'success');
      });
    }
  }, [showToast, notification]);
}
