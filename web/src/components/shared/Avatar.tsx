type Props = {
  size?: 32 | 40 | 48 | 64;
  src?: string;
  name?: string;
  className?: string;
};

export function Avatar({ size = 40, src, name = '', className = '' }: Props) {
  const initials = name.split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase() || '?';
  const gradient = `linear-gradient(135deg, #7C3AED, #6D28D9)`;

  return (
    <div className={`rounded-full shrink-0 overflow-hidden flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm" style={{ background: gradient }}>
          {initials}
        </div>
      )}
    </div>
  );
}
