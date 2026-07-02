import { createContext, useCallback, useContext, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type ToastType = 'success' | 'error' | 'info';

type Toast = {
  id: number;
  type: ToastType;
  title: string;
  description?: string;
};

type Ctx = { show: (type: ToastType, title: string, description?: string) => void };

const ToastContext = createContext<Ctx>({ show: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let _id = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((type: ToastType, title: string, description?: string) => {
    const id = ++_id;
    setToasts((prev) => [...prev, { id, type, title, description }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const colors: Record<ToastType, string> = {
    success: 'bg-success text-white',
    error: 'bg-error text-white',
    info: 'bg-text-main text-white',
  };

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-[400px] pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className={`pointer-events-auto px-4 py-3 rounded-bento shadow-modal ${colors[t.type]}`}
            >
              <p className="text-sm font-semibold">{t.title}</p>
              {t.description && <p className="text-xs opacity-80 mt-0.5">{t.description}</p>}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
