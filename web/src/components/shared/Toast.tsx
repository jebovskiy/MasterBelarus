import { create } from 'zustand';

export type ToastType = 'info' | 'warning' | 'success' | 'error';

type ToastState = {
  message: string | null;
  type: ToastType;
  showToast: (msg: string, type?: ToastType) => void;
};

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  type: 'info',
  showToast: (msg, type = 'info') => {
    set({ message: msg, type });

    try {
      const haptic = window.Telegram?.WebApp?.HapticFeedback;
      if (haptic) {
        if (type === 'warning' || type === 'error') {
          haptic.notificationOccurred(type === 'warning' ? 'warning' : 'error');
        } else {
          haptic.impactOccurred('medium');
        }
      }
    } catch { /* noop */ }

    setTimeout(() => set({ message: null }), 2500);
  },
}));

const icons: Record<ToastType, string> = {
  info: '💡',
  warning: '🛠️',
  success: '✅',
  error: '❌',
};

export function Toast() {
  const { message, type } = useToastStore();

  if (!message) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] w-[90%] max-w-xs animate-fade-in-up">
      <div className="bg-slate-900/95 backdrop-blur-md text-white text-xs font-medium py-3.5 px-4 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.25)] border border-slate-800 flex items-center gap-3">
        <span className="text-base flex-shrink-0">{icons[type]}</span>
        <span className="text-slate-200 text-left leading-snug">{message}</span>
      </div>
    </div>
  );
}
