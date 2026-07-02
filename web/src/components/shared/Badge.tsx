type Variant = 'success' | 'warning' | 'error' | 'neutral' | 'primary';

type Props = {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
};

const styles: Record<Variant, string> = {
  success: 'bg-success-tint text-success',
  warning: 'bg-[#FEF3C7] text-[#92400E]',
  error: 'bg-red-50 text-error',
  neutral: 'bg-app-surface-alt text-text-muted',
  primary: 'bg-primary-tint text-primary',
};

export function Badge({ variant = 'neutral', children, className = '' }: Props) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${styles[variant]} ${className}`}>
      {children}
    </span>
  );
}
