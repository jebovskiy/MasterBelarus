type Props = {
  label?: string;
  helperText?: string;
  error?: string;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  inputMode?: 'text' | 'numeric' | 'decimal' | 'url';
  maxLength?: number;
  rows?: number;
  multiline?: boolean;
  className?: string;
};

export function Input({ label, helperText, error, prefix, suffix, placeholder, value, onChange, type = 'text', inputMode, maxLength, rows = 3, multiline, className = '' }: Props) {
  const cls = `w-full rounded-btn border bg-white p-3 text-[15px] text-text-main placeholder:text-text-tertiary transition outline-none focus:ring-2 ${error ? 'border-error focus:ring-error/20' : 'border-app-border focus:border-primary focus:ring-primary/20'} ${className}`;

  return (
    <div>
      {label && <label className="block text-sm font-semibold text-text-main mb-1.5">{label}</label>}
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">{prefix}</span>}
        {multiline ? (
          <textarea value={value} onChange={(e) => onChange(e.target.value.slice(0, maxLength ?? 1000))} placeholder={placeholder} rows={rows} className={`${cls} resize-none ${prefix ? 'pl-8' : ''}`} />
        ) : (
          <input type={type} inputMode={inputMode} value={value} onChange={(e) => onChange(e.target.value.slice(0, maxLength ?? 200))} placeholder={placeholder} className={`${cls} ${prefix ? 'pl-8' : ''} ${suffix ? 'pr-16' : ''}`} />
        )}
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">{suffix}</span>}
      </div>
      {error && <p className="text-xs text-error mt-1">{error}</p>}
      {helperText && !error && <p className="text-xs text-text-muted mt-1">{helperText}</p>}
    </div>
  );
}
