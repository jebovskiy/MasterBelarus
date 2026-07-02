import { useState } from 'react';
import { useAuthStore } from '@/stores/auth';
import { AuthGuard } from '@/components/screens/SplashScreen';
import ClientHome from '@/pages/ClientHome';
import { MasterHome } from '@/components/screens/MasterHome';
import CreateOrderSheet from '@/components/screens/CreateOrderSheet';
import OrderDetail from '@/components/screens/OrderDetail';
import { useHaptic } from '@/hooks/useHaptic';

function AppShell() {
  const profile = useAuthStore((s) => s.profile);
  const [tab, setTab] = useState<'client' | 'master'>(profile?.role === 'master' ? 'master' : 'client');
  const [orderOpen, setOrderOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const { impact } = useHaptic();

  return (
    <div className="min-h-screen bg-app-bg">
      <nav className="sticky top-0 z-40 bg-app-bg/80 backdrop-blur-md border-b border-app-border">
        <div className="max-w-[430px] mx-auto flex items-center justify-around px-4 h-14">
          <button onClick={() => { setTab('client'); impact('light'); }} className={`flex flex-col items-center gap-0.5 text-xs font-semibold transition ${tab !== 'master' ? 'text-primary' : 'text-text-muted'}`}><span className="text-lg">🏠</span>Клиенту</button>
          <button onClick={() => { setTab('master'); impact('light'); }} className={`flex flex-col items-center gap-0.5 text-xs font-semibold transition ${tab === 'master' ? 'text-primary' : 'text-text-muted'}`}><span className="text-lg">👷</span>Мастеру</button>
        </div>
      </nav>

      {tab !== 'master' ? (
        <ClientHome onOpenCreateOrder={() => setOrderOpen(true)} />
      ) : (
        <MasterHome />
      )}

      <OrderDetail orderId={selectedOrderId} onBack={() => setSelectedOrderId(null)} />
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
