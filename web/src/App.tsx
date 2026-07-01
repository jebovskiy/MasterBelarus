import { useState } from 'react';
import { useAuthStore } from '@/stores/auth';
import AuthGuard from '@/components/screens/SplashScreen';
import ClientHome from '@/pages/ClientHome';
import { MasterHome } from '@/components/screens/MasterHome';
import CreateOrderSheet from '@/components/screens/CreateOrderSheet';
import { useHaptic } from '@/hooks/useHaptic';

type Tab = 'client' | 'master';

function AppShell() {
  const profile = useAuthStore((s) => s.profile);
  const [tab, setTab] = useState<Tab>(profile?.role === 'master' ? 'master' : 'client');
  const [orderOpen, setOrderOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<{ id: string } | null>(null);
  const { impact } = useHaptic();

  const isMaster = tab === 'master';

  return (
    <div className="min-h-screen bg-app-bg">
      <nav className="sticky top-0 z-40 bg-app-bg/80 backdrop-blur-md border-b border-app-border">
        <div className="max-w-[430px] mx-auto flex items-center justify-around px-4 h-14">
          <button
            onClick={() => {
              setTab('client');
              impact('light');
            }}
            className={`flex flex-col items-center gap-0.5 text-xs font-semibold transition ${
              !isMaster ? 'text-primary' : 'text-text-muted'
            }`}
          >
            <span className="text-lg">🏠</span>
            Клиенту
          </button>
          <button
            onClick={() => {
              setTab('master');
              impact('light');
            }}
            className={`flex flex-col items-center gap-0.5 text-xs font-semibold transition ${
              isMaster ? 'text-primary' : 'text-text-muted'
            }`}
          >
            <span className="text-lg">👷</span>
            Мастеру
          </button>
        </div>
      </nav>

      {!isMaster ? (
        <ClientHome onOpenCreateOrder={() => setOrderOpen(true)} />
      ) : (
        <MasterHome
          onOpenOrder={(order) => setSelectedOrder({ id: order.id })}
        />
      )}

      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-app-bg p-4">
          <header className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-text-main">Заказ #{selectedOrder.id.slice(0, 8)}</h2>
            <button
              onClick={() => setSelectedOrder(null)}
              className="px-3 h-8 rounded-btn bg-app-surface-alt text-sm font-semibold"
            >
              Назад
            </button>
          </header>
          <p className="text-text-muted">Детали заказа — Sprint 2 продолжение.</p>
        </div>
      )}

      <CreateOrderSheet open={orderOpen} onClose={() => setOrderOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <AuthGuard>
      <AppShell />
    </AuthGuard>
  );
}
