import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '@/stores/auth';
import { AuthGuard } from '@/components/screens/SplashScreen';
import ClientHome from '@/pages/ClientHome';
import { MasterHome } from '@/components/screens/MasterHome';
import { MasterInProgress } from '@/components/screens/MasterInProgress';
import CreateOrderSheet from '@/components/screens/CreateOrderSheet';
import OrderDetail from '@/components/screens/OrderDetail';
import Profile from '@/components/screens/Profile';
import AdminPanelView from '@/components/screens/AdminPanelView';
import SettingsScreen from '@/components/screens/SettingsScreen';
import EditProfileScreen from '@/components/screens/EditProfileScreen';
import WalletScreen from '@/components/screens/WalletScreen';
import OrderHistoryScreen from '@/components/screens/OrderHistoryScreen';
import { BottomTabBar, type TabKey } from '@/components/shared/BottomTabBar';
import { Toast } from '@/components/shared/Toast';
import { useStartAppHandler } from '@/hooks/useStartAppHandler';

type Overlay = 'settings' | 'edit_profile' | 'wallet' | 'order_history' | 'admin';

function AppOverlay({ overlay, onClose }: { overlay: Overlay | null; onClose: () => void }) {
  if (!overlay) return null;
  return (
    <motion.div key={overlay} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }} className="fixed inset-0 z-[60] bg-[#f4f4f6] overflow-y-auto">
      {overlay === 'settings' && <SettingsScreen onBack={onClose} />}
      {overlay === 'edit_profile' && <EditProfileScreen onBack={onClose} />}
      {overlay === 'wallet' && <WalletScreen onBack={onClose} />}
      {overlay === 'order_history' && <OrderHistoryScreen onBack={onClose} />}
      {overlay === 'admin' && <AdminPanelView onClose={onClose} />}
    </motion.div>
  );
}

function CustomerApp() {
  const [tab, setTab] = useState<TabKey>('home');
  const [orderOpen, setOrderOpen] = useState(false);
  const [presetCategory, setPresetCategory] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Overlay | null>(null);

  return (
    <div className="min-h-screen bg-[#f4f4f6] pb-[calc(64px+env(safe-area-inset-bottom,0px))]">
      {tab === 'home' && <ClientHome onOpenCreateOrder={(cat) => { setPresetCategory(cat ?? null); setOrderOpen(true); }} onOpenOrder={(id) => setSelectedOrderId(id)} />}
      {tab === 'orders' && <OrderHistoryScreen onBack={() => setTab('home')} onOpenOrder={(id) => { setSelectedOrderId(id); }} />}
      {tab === 'profile' && <Profile onBack={() => setTab('home')} onNavigate={(s) => setOverlay(s as Overlay | null)} />}

      <BottomTabBar active={tab} onTab={setTab} />
      <OrderDetail orderId={selectedOrderId} onBack={() => setSelectedOrderId(null)} />
      <CreateOrderSheet open={orderOpen} onClose={() => { setOrderOpen(false); setPresetCategory(null); }} presetCategory={presetCategory} />

      <AnimatePresence>
        <AppOverlay overlay={overlay} onClose={() => setOverlay(null)} />
      </AnimatePresence>
    </div>
  );
}

function MasterApp() {
  const [tab, setTab] = useState<TabKey>('feed');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Overlay | null>(null);

  return (
    <div className="min-h-screen bg-[#f4f4f6] pb-[calc(64px+env(safe-area-inset-bottom,0px))]">
      {tab === 'feed' && <MasterHome onNavigate={(s) => setOverlay(s as Overlay)} />}
      {tab === 'in_progress' && <MasterInProgress onOpenOrder={(id) => setSelectedOrderId(id)} />}
      {tab === 'profile' && <Profile onBack={() => setTab('feed')} onNavigate={(s) => setOverlay(s as Overlay | null)} />}

      <BottomTabBar active={tab} onTab={setTab} />
      <OrderDetail orderId={selectedOrderId} onBack={() => setSelectedOrderId(null)} />

      <AnimatePresence>
        <AppOverlay overlay={overlay} onClose={() => setOverlay(null)} />
      </AnimatePresence>
    </div>
  );
}

function AppShell() {
  const profile = useAuthStore((s) => s.profile);
  const isMasterMode = profile?.current_role === 'master' && profile?.is_master;

  useStartAppHandler();

  return (
    <AnimatePresence mode="wait">
      {isMasterMode ? (
        <motion.div
          key="master"
          className="min-h-dvh"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <MasterApp />
        </motion.div>
      ) : (
        <motion.div
          key="customer"
          className="min-h-dvh"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <CustomerApp />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <AuthGuard>
      <AppShell />
      <Toast />
    </AuthGuard>
  );
}
