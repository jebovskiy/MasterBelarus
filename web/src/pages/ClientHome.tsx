import { useHaptic } from '@/hooks/useHaptic';

const CATEGORIES = [
  { key: 'plumber', label: 'Сантехник', icon: '🔧' },
  { key: 'electrician', label: 'Электрик', icon: '⚡' },
  { key: 'mover', label: 'Грузчик', icon: '📦' },
  { key: 'handyman', label: 'Муж на час', icon: '🛠' },
  { key: 'tutor', label: 'Репетитор', icon: '📚' },
  { key: 'cleaning', label: 'Уборка', icon: '🧹' },
];

type ClientHomeProps = {
  onOpenCreateOrder: () => void;
  onOpenOrder?: (id: string) => void;
};

export default function ClientHome({ onOpenCreateOrder, onOpenOrder }: ClientHomeProps) {
  const { impact } = useHaptic();

  return (
    <div className="min-h-screen bg-app-bg pb-24">
      <div className="px-4 pt-4">
        <div className="bg-white p-6 rounded-bento shadow-card">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Бытовые услуги</p>
              <h1 className="text-2xl font-extrabold text-text-main mt-1 leading-tight">Нужен мастер сегодня?</h1>
              <p className="text-[13px] text-text-muted mt-1">Отклик за 5 минут</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl shrink-0">🔨</div>
          </div>
          <button onClick={onOpenCreateOrder} className="w-full mt-5 h-12 rounded-btn bg-primary hover:bg-primary-hover text-white font-semibold text-[15px] shadow-accent-glow transition-all duration-180 active:scale-[0.98]">+ Создать заявку</button>
        </div>
      </div>

      <div className="px-4 mt-4">
        <h2 className="text-lg font-bold text-text-main px-1 mb-2">Популярные услуги</h2>
        <div className="grid grid-cols-2 gap-3">
          {CATEGORIES.map((cat) => (
            <button key={cat.key} onClick={() => { impact('light'); onOpenOrder?.(cat.key); }} className="bg-white p-4 rounded-bento shadow-card h-24 flex flex-col justify-between hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-180 active:scale-[0.98]">
              <span className="text-2xl">{cat.icon}</span>
              <span className="text-sm font-semibold text-text-main">{cat.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
