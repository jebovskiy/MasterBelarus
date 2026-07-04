import { useState } from 'react';
import { useToastStore } from '@/components/shared/Toast';

type Props = { onBack: () => void };

const QUICK_AMOUNTS = [10, 20, 50, 100, 200, 500];

export default function WalletScreen({ onBack }: Props) {
  const [balance] = useState(15);
  const [amount, setAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'erip'>('card');
  const [step, setStep] = useState<'form' | 'success'>('form');
  const showToast = useToastStore((s) => s.showToast);

  const finalAmount = amount || 0;

  const quickSelect = (val: number) => setAmount(val);

  const pay = () => {
    if (finalAmount <= 0) {
      showToast('Укажите сумму пополнения', 'warning');
      return;
    }
    setStep('success');
  };

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-[#f4f4f6] flex flex-col items-center justify-center px-6">
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center max-w-sm w-full space-y-4">
          <span className="text-5xl block">✅</span>
          <h2 className="text-xl font-bold text-slate-900">Баланс пополнен!</h2>
          <p className="text-3xl font-extrabold text-slate-800">+{finalAmount} BYN</p>
          <p className="text-sm text-slate-500">Средства зачислены на ваш счёт</p>
          <button
            onClick={onBack}
            className="w-full bg-slate-900 text-white rounded-xl py-4 font-semibold text-sm active:scale-[0.98] transition-all mt-4"
          >
            Вернуться
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#f4f4f6] flex flex-col">
      <div className="flex items-center gap-3 px-4 pt-4 pb-2 shrink-0">
        <button onClick={onBack} className="text-slate-600 text-sm font-medium">← Назад</button>
        <h1 className="text-lg font-bold text-slate-900">Пополнение баланса</h1>
      </div>

      <div className="flex-1 px-4 space-y-4 overflow-y-auto pb-32">

        <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Текущий баланс</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{balance.toFixed(2)} BYN</p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Выберите сумму</span>

          <div className="grid grid-cols-3 gap-2">
            {QUICK_AMOUNTS.map((val) => (
              <button
                key={val}
                onClick={() => quickSelect(val)}
                className={`py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.97] ${
                  amount === val ? 'bg-slate-800 text-white shadow-md' : 'bg-[#f4f4f6] text-slate-700'
                }`}
              >
                {val} BYN
              </button>
            ))}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Другая сумма</label>
            <input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="0"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-center text-xl font-bold focus:outline-none focus:border-slate-400"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Способ оплаты</span>
          {[
            { value: 'card' as const, label: 'Банковская карта', icon: '💳' },
            { value: 'erip' as const, label: 'ЕРИП', icon: '🏦' },
          ].map(({ value, label, icon }) => (
            <button
              key={value}
              onClick={() => setPaymentMethod(value)}
              className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all ${
                paymentMethod === value ? 'bg-slate-800 text-white' : 'bg-[#f4f4f6] text-slate-700'
              }`}
            >
              <span className="text-lg">{icon}</span>
              <span className="text-sm font-semibold flex-1 text-left">{label}</span>
              {paymentMethod === value && <span className="text-white">✓</span>}
            </button>
          ))}
        </div>

      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#f4f4f6] via-[#f4f4f6]/95 to-transparent pt-8 pb-[calc(16px+env(safe-area-inset-bottom,0px))] px-4">
        <button
          onClick={pay}
          className="w-full bg-slate-900 text-white rounded-xl py-4 font-semibold text-sm active:scale-[0.98] transition-all shadow-md"
        >
          Перейти к оплате — {finalAmount > 0 ? `${finalAmount} BYN` : 'Сумма не указана'}
        </button>
      </div>
    </div>
  );
}
