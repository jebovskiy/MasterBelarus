import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from '@/stores/auth';
import { AuthGuard } from '@/components/screens/SplashScreen';
import ClientHome from '@/pages/ClientHome';
import { MasterHome } from '@/components/screens/MasterHome';
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

type Overlay = 'settings' | 'edit_profile' | 'wallet' | 'order_history';

function CustomerApp() {
  const [tab, setTab] = useState<TabKey>('home');
  const [orderOpen, setOrderOpen] = useState(false);
  const [presetCategory, setPresetCategory] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [overlay, setOverlay] = useState<Overlay | null>(null);

  return (
    <div className="min-h-screen bg-[#f4f4f6] pb-[calc(64px+env(safe-area-inset-bottom,0px))]">
      {tab === 'home' && <ClientHome onOpenCreateOrder={(cat) => { setPresetCategory(cat ?? null); setOrderOpen(true); }} />}
      {tab === 'orders' && <OrderHistoryScreen onBack={() => setTab('home')} onOpenOrder={(id) => { setSelectedOrderId(id); }} />}
      {tab === 'profile' && <Profile onBack={() => setTab('home')} onNavigate={(s) => setOverlay(s as Overlay)} />}

      <BottomTabBar active={tab} onTab={setTab} />
      <OrderDetail orderId={selectedOrderId} onBack={() => setSelectedOrderId(null)} />
      <CreateOrderSheet open={orderOpen} onClose={() => { setOrderOpen(false); setPresetCategory(null); }} presetCategory={presetCategory} />

      <AnimatePresence>
        {adminOpen && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }} className="fixed inset-0 z-40">
            <AdminPanelView onClose={() => setAdminOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {overlay && (
          <motion.div key={overlay} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }} className="fixed inset-0 z-30 bg-[#f4f4f6] overflow-y-auto">
            {overlay === 'settings' && <SettingsScreen onBack={() => setOverlay(null)} />}
            {overlay === 'edit_profile' && <EditProfileScreen onBack={() => setOverlay(null)} />}
            {overlay === 'wallet' && <WalletScreen onBack={() => setOverlay(null)} />}
            {overlay === 'order_history' && <OrderHistoryScreen onBack={() => setOverlay(null)} onOpenOrder={(id) => { setSelectedOrderId(id); setOverlay(null); }} />}
          </motion.div>
        )}
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
      {tab === 'in_progress' && (
        <div className="px-4 pt-4">
          <p className="text-slate-400 text-sm text-center py-10">Заказы в работе</p>
        </div>
      )}
      {tab === 'profile' && <Profile onBack={() => setTab('feed')} onNavigate={(s) => setOverlay(s as Overlay)} />}

      <BottomTabBar active={tab} onTab={setTab} />
      <OrderDetail orderId={selectedOrderId} onBack={() => setSelectedOrderId(null)} />

      <AnimatePresence>
        {overlay && (
          <motion.div key={overlay} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }} className="fixed inset-0 z-30 bg-[#f4f4f6] overflow-y-auto">
            {overlay === 'edit_profile' && <EditProfileScreen onBack={() => setOverlay(null)} />}
            {overlay === 'wallet' && <WalletScreen onBack={() => setOverlay(null)} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AppShell() {
  const profile = useAuthStore((s) => s.profile);
  const isMasterMode = profile?.current_role === 'master' && profile?.is_master;

  return isMasterMode ? <MasterApp /> : <CustomerApp />;
}

export default function App() {
  return (
    <AuthGuard>
      <AppShell />
      <Toast />
    </AuthGuard>
  );
}
