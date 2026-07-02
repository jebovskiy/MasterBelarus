import { motion } from 'framer-motion';

export type TabKey = 'home' | 'orders' | 'chat' | 'profile';

const TABS: { key: TabKey; label: string; icon: string; activeIcon: string }[] = [
  { key: 'home', label: 'Главная', icon: '🏠', activeIcon: '🏠' },
  { key: 'orders', label: 'Заказы', icon: '📋', activeIcon: '📋' },
  { key: 'chat', label: 'Чат', icon: '💬', activeIcon: '💬' },
  { key: 'profile', label: 'Профиль', icon: '👤', activeIcon: '👤' },
];

type Props = {
  active: TabKey;
  onTab: (key: TabKey) => void;
};

export function BottomTabBar({ active, onTab }: Props) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/85 backdrop-blur-lg border-t border-app-border" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="max-w-[430px] mx-auto flex items-center justify-around h-16">
        {TABS.map((t) => {
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
              <span className={`text-[10px] font-semibold ${isActive ? 'text-primary' : 'text-text-tertiary'}`}>
                {t.label}
              </span>
              {isActive && (
                <motion.div layoutId="tab-indicator" className="absolute -top-0.5 w-8 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
