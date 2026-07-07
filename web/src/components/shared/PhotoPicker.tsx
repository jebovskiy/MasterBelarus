import { useState, useRef, useEffect, useId } from 'react';
import { useHaptic } from '@/hooks/useHaptic';

type Props = {
  files: File[];
  onChange: (files: File[]) => void;
  max?: number;
  disabled?: boolean;
};

export default function PhotoPicker({ files, onChange, max = 3, disabled }: Props) {
  const [previews, setPreviews] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const { impact } = useHaptic();
  const id = useId();

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;
    impact('light');
    const remaining = max - files.length;
    const allowed = selected.slice(0, remaining);
    onChange([...files, ...allowed]);
    e.target.value = '';
  };

  const remove = (idx: number) => {
    impact('medium');
    onChange(files.filter((_, i) => i !== idx));
  };

  const slots = Array.from({ length: max }, (_, i) => i);

  return (
    <div className="grid grid-cols-3 gap-3">
      {slots.map((i) => {
        const hasFile = i < files.length;
        return (
          <div
            key={`${id}-${i}`}
            className={`relative aspect-square rounded-xl overflow-hidden border-2 border-dashed border-slate-300 bg-[#f4f4f6] flex items-center justify-center transition-all ${disabled ? 'opacity-50' : ''}`}
          >
            {hasFile ? (
              <>
                <img src={previews[i]} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => remove(i)}
                  disabled={disabled}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-slate-900/70 text-white text-xs flex items-center justify-center hover:bg-slate-900 transition-colors"
                >
                  ✕
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={disabled || files.length >= max}
                onClick={() => fileRef.current?.click()}
                className="w-full h-full flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <span className="text-2xl">+</span>
              </button>
            )}
          </div>
        );
      })}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={handleSelect}
      />
    </div>
  );
}
