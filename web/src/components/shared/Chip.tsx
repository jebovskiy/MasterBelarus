type Props = {
  active?: boolean;
  removable?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  children: React.ReactNode;
  className?: string;
};

export function Chip({ active, removable, onClick, onRemove, children, className = '' }: Props) {
  const base = 'inline-flex items-center gap-1 px-3 h-8 rounded-full text-sm font-semibold transition-all duration-180';
  const state = active
    ? 'bg-primary-tint text-primary border border-primary/30'
    : 'bg-white text-text-muted border border-app-border hover:border-primary/40';

  return (
    <button onClick={onClick} className={`${base} ${state} ${className}`}>
      {children}
      {removable && <span onClick={(e) => { e.stopPropagation(); onRemove?.(); }} className="ml-1 text-text-tertiary hover:text-error">✕</span>}
    </button>
  );
}
