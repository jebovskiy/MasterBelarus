import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';

export type TabKey = 'home' | 'orders' | 'chat' | 'profile' | 'feed' | 'in_progress';

type Props = {
  active: TabKey;
  onTab: (key: TabKey) => void;
};

export function BottomTabBar({ active, onTab }: Props) {
  const { t } = useTranslation();
  const profile = useAuthStore((s) => s.profile);
  const isMasterMode = profile?.current_role === 'master' && profile?.is_master;

  const CUSTOMER_TABS: { key: TabKey; label: string; icon: string }[] = [
    { key: 'home', label: t('nav.home'), icon: '🏠' },
    { key: 'orders', label: t('nav.orders'), icon: '📋' },
    { key: 'profile', label: t('nav.profile'), icon: '👤' },
  ];

  const MASTER_TABS: { key: TabKey; label: string; icon: string }[] = [
    { key: 'feed', label: t('nav.feed'), icon: '📋' },
    { key: 'in_progress', label: t('nav.in_progress'), icon: '🔧' },
    { key: 'profile', label: t('nav.profile'), icon: '👤' },
  ];

  const tabs = isMasterMode ? MASTER_TABS : CUSTOMER_TABS;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-appSurface/85 backdrop-blur-lg border-t border-appBorder" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="max-w-[430px] mx-auto flex items-center justify-around h-16">
        {tabs.map((t) => {
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onTab(t.key)}
              className="relative flex flex-col items-center gap-0.5 w-16 py-1 transition-colors duration-180"
            >
              <span className={`text-xl transition-transform duration-180 ${isActive ? 'scale-110' : ''}`}>
                {t.icon}
              </span>
              <span className={`text-[10px] font-semibold ${isActive ? 'text-textMain' : 'text-textMuted'}`}>
                {t.label}
              </span>
              {isActive && (
                <motion.div layoutId="tab-indicator" className="absolute -top-0.5 w-8 h-0.5 rounded-full bg-textMain" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
