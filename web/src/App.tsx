import { useState } from 'react';
import { useAuthStore } from '@/stores/auth';
import { AuthGuard } from '@/components/screens/SplashScreen';
import ClientHome from '@/pages/ClientHome';
import { MasterHome } from '@/components/screens/MasterHome';
import CreateOrderSheet from '@/components/screens/CreateOrderSheet';
import OrderDetail from '@/components/screens/OrderDetail';
import Profile from '@/components/screens/Profile';
import AdminDashboard from '@/components/screens/AdminDashboard';
import { BottomTabBar, type TabKey } from '@/components/shared/BottomTabBar';
import { ToastProvider } from '@/components/shared/Toast';

function AppShell() {
  const profile = useAuthStore((s) => s.profile);
  const [tab, setTab] = useState<TabKey>('home');
  const [orderOpen, setOrderOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);

  const isMaster = profile?.role === 'master';

  return (
    <div className="min-h-screen bg-app-bg pb-[calc(64px+env(safe-area-inset-bottom,0px))]">
      {tab === 'home' && (isMaster ? <MasterHome /> : <ClientHome onOpenCreateOrder={() => setOrderOpen(true)} />)}

      {tab === 'orders' && (
        <div className="px-4 pt-4">
          <p className="text-text-muted text-sm text-center py-10">История заказов</p>
        </div>
      )}

      {tab === 'chat' && (
        <div className="px-4 pt-4">
          <p className="text-text-muted text-sm text-center py-10">Чат с мастерами</p>
        </div>
      )}

      {tab === 'profile' && <Profile onOpenAdmin={() => setAdminOpen(true)} />}

      {!adminOpen && <BottomTabBar active={tab} onTab={setTab} />}
      <OrderDetail orderId={selectedOrderId} onBack={() => setSelectedOrderId(null)} />
      <CreateOrderSheet open={orderOpen} onClose={() => setOrderOpen(false)} />
      {adminOpen && <AdminDashboard onClose={() => setAdminOpen(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthGuard>
        <AppShell />
      </AuthGuard>
    </ToastProvider>
  );
}
