import { motion } from 'framer-motion';
import { useHaptic } from '@/hooks/useHaptic';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

type Props = {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
};

const variantStyles: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:shadow-accent-glow',
  secondary: 'bg-white text-text-main border border-app-border hover:bg-app-surface-alt',
  ghost: 'bg-transparent text-text-muted hover:text-text-main',
  danger: 'bg-error text-white',
};

const sizeStyles: Record<Size, string> = {
  sm: 'px-3 h-8 text-xs',
  md: 'px-4 h-10 text-sm',
  lg: 'w-full h-12 text-[15px] font-semibold',
};

export function Button({ variant = 'primary', size = 'md', loading, disabled, className = '', onClick, children }: Props) {
  const { impact } = useHaptic();
  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      onClick={() => { impact('light'); onClick?.(); }}
      disabled={disabled || loading}
      className={`rounded-btn font-semibold transition-all duration-180 disabled:opacity-50 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {loading ? <span className="inline-block animate-spin">⟳</span> : children}
    </motion.button>
  );
}

export function IconButton({ onClick, children, className = '' }: { onClick?: () => void; children: React.ReactNode; className?: string }) {
  const { impact } = useHaptic();
  return (
    <button
      onClick={() => { impact('light'); onClick?.(); }}
      className={`w-10 h-10 rounded-xl flex items-center justify-center active:scale-90 transition-transform duration-180 ${className}`}
    >
      {children}
    </button>
  );
}
