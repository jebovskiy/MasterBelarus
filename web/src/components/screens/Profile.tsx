import { useState } from 'react';
import { useAuthStore } from '@/stores/auth';
import { useHaptic } from '@/hooks/useHaptic';
import { useAdminStore } from '@/stores/admin';
import { Avatar } from '@/components/shared/Avatar';

type Role = 'client' | 'master';

const SPECIALTIES = ['Сантехника', 'Электрика', 'Мелкий ремонт'];
const MOCK_MASTER = {
  about: 'Работаю сантехником и электриком более 8 лет. Выезжаю по Минску и области. Гарантия на все виды работ. Использую профессиональный инструмент и качественные материалы. Работаю аккуратно, после себя убираю.',
  completed: 142,
  active: 3,
};

export default function Profile({ onOpenAdmin }: { onOpenAdmin?: () => void }) {
  const profile = useAuthStore((s) => s.profile);
  const isAdmin = useAdminStore((s) => s.isAdmin);
  const [role, setRole] = useState<Role>(profile?.role ?? 'client');
  const { impact } = useHaptic();

  const isMaster = role === 'master';
  const name = profile?.full_name ?? profile?.username ?? 'Пользователь';
  const phone = '+375 (29) XXX-XX-XX';

  return (
    <div className="bg-[#f4f4f6] min-h-screen p-4 space-y-4">
      <div className="flex justify-between items-center px-1">
        <button className="text-slate-600 text-sm font-medium">← Назад</button>
        <button className="text-slate-400 text-lg">⚙️</button>
      </div>

      <div className="bg-slate-200/60 rounded-xl p-1 flex w-full">
        {(['client', 'master'] as const).map((r) => {
          const active = role === r;
          return (
            <button
              key={r}
              onClick={() => { setRole(r); impact('light'); }}
              className={`flex-1 text-center text-xs py-2.5 rounded-lg transition-all ${
                active
                  ? 'bg-white text-slate-800 font-semibold shadow-sm'
                  : 'text-slate-500 font-medium'
              }`}
            >
              {r === 'client' ? 'Я заказчик' : 'Я мастер'}
            </button>
          );
        })}
      </div>

      {isMaster ? (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm flex items-center gap-4">
            <Avatar size={48} name={name} />
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-slate-800 truncate">{name}</h2>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-amber-500 text-xs">★</span>
                <span className="text-slate-600 text-xs font-semibold">{profile?.avg_rating?.toFixed(1) ?? '5.0'}</span>
                <span className="text-slate-400 text-xs">• {profile?.review_count ?? 0} отзывов</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {SPECIALTIES.map((s) => (
                  <span key={s} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium">{s}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center gap-2">
            <span className="text-sm">🛡️</span>
            <span className="text-xs font-semibold text-emerald-800">Статус: Проверен (Плательщик НПД)</span>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">О мастере</span>
            <p className="text-sm text-slate-600 leading-relaxed">{MOCK_MASTER.about}</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Статистика</span>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#f4f4f6] rounded-xl p-4 text-center">
                <span className="block text-2xl font-bold text-slate-800">{MOCK_MASTER.completed}</span>
                <span className="text-[11px] text-slate-500">Выполнено</span>
              </div>
              <div className="bg-[#f4f4f6] rounded-xl p-4 text-center">
                <span className="block text-2xl font-bold text-slate-800">{MOCK_MASTER.active}</span>
                <span className="text-[11px] text-slate-500">В работе</span>
              </div>
            </div>
          </div>

          <button className="w-full bg-slate-900 text-white rounded-xl py-4 text-center text-sm font-semibold active:scale-[0.99] transition-transform">
            Редактировать анкету мастера
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm flex items-center gap-4">
            <Avatar size={48} name={name} />
            <div>
              <h2 className="text-lg font-bold text-slate-800">{name}</h2>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-amber-500 text-xs">★</span>
                <span className="text-slate-600 text-xs font-semibold">5.0</span>
                <span className="text-slate-400 text-xs">• Надежный клиент</span>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono">{phone}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Мои заказы</span>
            <div className="grid grid-cols-2 gap-2 text-center">
              <button className="bg-[#f4f4f6] rounded-xl p-3 active:scale-[0.97] transition-transform">
                <span className="block text-xl font-bold text-slate-800">1</span>
                <span className="text-[11px] text-slate-500">Активный заказ</span>
              </button>
              <button className="bg-[#f4f4f6] rounded-xl p-3 active:scale-[0.97] transition-transform">
                <span className="block text-xl font-bold text-slate-400">12</span>
                <span className="text-[11px] text-slate-500">Завершенных</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Способы оплаты</span>
            <div className="space-y-2">
              {['Наличные', 'Банковская карта', 'ЕРИП'].map((m) => (
                <label key={m} className="flex items-center gap-3 p-3 rounded-xl bg-[#f4f4f6] cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4 rounded accent-slate-800" />
                  <span className="text-sm text-slate-700 font-medium">{m}</span>
                </label>
              ))}
            </div>
          </div>

          <button className="w-full bg-slate-100 text-slate-800 rounded-xl py-4 text-center text-sm font-semibold active:scale-[0.99] transition-transform">
            Изменить личные данные
          </button>
        </div>
      )}

      <button className="w-full bg-transparent text-rose-500/60 font-medium text-xs py-2 text-center block mt-4 hover:text-rose-600 transition-colors">
        Выйти из аккаунта
      </button>

      {isAdmin && onOpenAdmin && (
        <button onClick={onOpenAdmin} className="w-full bg-white rounded-2xl p-5 shadow-sm flex items-center justify-between active:scale-[0.97] transition-transform">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-base">🛠</div>
            <span className="text-sm font-semibold text-slate-800">Панель администратора</span>
          </div>
          <span className="text-slate-300 text-lg leading-none">→</span>
        </button>
      )}
    </div>
  );
}
