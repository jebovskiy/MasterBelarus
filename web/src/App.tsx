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

type Screen = 'settings' | 'edit_profile' | 'wallet' | 'order_history';

function AppShell() {
  const profile = useAuthStore((s) => s.profile);
  const [tab, setTab] = useState<TabKey>('home');
  const [orderOpen, setOrderOpen] = useState(false);
  const [presetCategory, setPresetCategory] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [screen, setScreen] = useState<Screen | null>(null);

  const isMaster = profile?.role === 'master';

  return (
    <div className="min-h-screen bg-app-bg pb-[calc(64px+env(safe-area-inset-bottom,0px))]">
      {tab === 'home' && (isMaster ? <MasterHome onNavigate={(s) => setScreen(s as Screen)} /> : <ClientHome onOpenCreateOrder={(cat) => { setPresetCategory(cat ?? null); setOrderOpen(true); }} />)}

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

      {tab === 'profile' && <Profile onBack={() => setTab('home')} onNavigate={(s) => setScreen(s as Screen)} />}

      {!adminOpen && !screen && <BottomTabBar active={tab} onTab={setTab} onAdminChoice={() => setAdminOpen(true)} />}
      <OrderDetail orderId={selectedOrderId} onBack={() => setSelectedOrderId(null)} />
      <CreateOrderSheet open={orderOpen} onClose={() => { setOrderOpen(false); setPresetCategory(null); }} presetCategory={presetCategory} />
      <AnimatePresence>
        {adminOpen && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-0 z-40"
          >
            <AdminPanelView onClose={() => setAdminOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {screen && (
          <motion.div
            key={screen}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-0 z-30 bg-[#f4f4f6] overflow-y-auto"
          >
            {screen === 'settings' && <SettingsScreen onBack={() => setScreen(null)} />}
            {screen === 'edit_profile' && <EditProfileScreen onBack={() => setScreen(null)} />}
            {screen === 'wallet' && <WalletScreen onBack={() => setScreen(null)} />}
            {screen === 'order_history' && <OrderHistoryScreen onBack={() => setScreen(null)} onOpenOrder={(id) => { setSelectedOrderId(id); setScreen(null); }} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
