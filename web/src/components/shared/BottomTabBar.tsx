import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/stores/auth';

export type TabKey = 'home' | 'orders' | 'chat' | 'profile';

const ADMIN_ID = Number(import.meta.env.VITE_ADMIN_TELEGRAM_ID);

const TABS: { key: TabKey; label: string; icon: string; activeIcon: string }[] = [
  { key: 'home', label: 'Главная', icon: '🏠', activeIcon: '🏠' },
  { key: 'orders', label: 'Заказы', icon: '📋', activeIcon: '📋' },
  { key: 'chat', label: 'Чат', icon: '💬', activeIcon: '💬' },
  { key: 'profile', label: 'Профиль', icon: '👤', activeIcon: '👤' },
];

type Props = {
  active: TabKey;
  onTab: (key: TabKey) => void;
  onAdminChoice?: () => void;
};

export function BottomTabBar({ active, onTab, onAdminChoice }: Props) {
  const profile = useAuthStore((s) => s.profile);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const isLongPress = useRef(false);
  const isAdmin = ADMIN_ID && profile?.telegram_id === ADMIN_ID;

  const clearTimer = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = undefined; }
  };

  const handlePointerDown = () => {
    if (!isAdmin) return;
    isLongPress.current = false;
    timerRef.current = setTimeout(() => {
      isLongPress.current = true;
      setShowAdminMenu(true);
    }, 500);
  };

  const handlePointerUp = () => { clearTimer(); };

  const handleClick = (key: TabKey, e: React.MouseEvent) => {
    if (isLongPress.current) { e.preventDefault(); isLongPress.current = false; return; }
    if (showAdminMenu) { setShowAdminMenu(false); return; }
    onTab(key);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/85 backdrop-blur-lg border-t border-app-border" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="max-w-[430px] mx-auto flex items-center justify-around h-16">
        {TABS.map((t) => {
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              onClick={(e) => handleClick(t.key, e)}
              onPointerDown={t.key === 'profile' ? handlePointerDown : undefined}
              onPointerUp={t.key === 'profile' ? handlePointerUp : undefined}
              onPointerLeave={t.key === 'profile' ? handlePointerUp : undefined}
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
              {t.key === 'profile' && showAdminMenu && (
                <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-lg border border-slate-100 p-1.5 min-w-[180px] z-50">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowAdminMenu(false); onTab('profile'); }}
                    className="w-full text-left px-3 py-2.5 text-sm font-medium text-slate-800 rounded-lg hover:bg-slate-50 flex items-center gap-2.5"
                  >
                    <span className="text-base">👤</span>
                    <span>Профиль</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowAdminMenu(false); onAdminChoice?.(); }}
                    className="w-full text-left px-3 py-2.5 text-sm font-medium text-slate-800 rounded-lg hover:bg-slate-50 flex items-center gap-2.5"
                  >
                    <span className="text-base">🛠</span>
                    <span>Админ-панель</span>
                  </button>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
