import { useCallback } from 'react';

type ImpactStyle = 'light' | 'medium' | 'heavy';
type NotificationType = 'error' | 'success' | 'warning';

export function useHaptic() {
  const impact = useCallback((style: ImpactStyle = 'light') => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.(style);
    } catch { /* noop */ }
  }, []);

  const notification = useCallback((type: NotificationType = 'success') => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(type);
    } catch { /* noop */ }
  }, []);

  return { impact, notification };
}
