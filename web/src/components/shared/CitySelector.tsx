import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BELARUS_CITIES } from '@/data/belarus-cities';
import { useHaptic } from '@/hooks/useHaptic';

export type CityValue = {
  city: string;
  district?: string;
  oblast: string;
};

type Props = {
  value: CityValue | null;
  onChange: (v: CityValue) => void;
};

const sheetTransition = { duration: 0.25, ease: [0.32, 0.72, 0, 1] };

export default function CitySelector({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'oblast' | 'city' | 'district'>('oblast');
  const [selectedOblast, setSelectedOblast] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const { impact } = useHaptic();

  const oblast = useMemo(
    () => BELARUS_CITIES.find((o) => o.name === selectedOblast),
    [selectedOblast],
  );

  const cityData = useMemo(
    () => oblast?.cities.find((c) => c.name === selectedCity),
    [oblast?.cities, selectedCity],
  );

  const displayText = value
    ? value.district
      ? `г. ${value.city}, ${value.district} р-н`
      : `г. ${value.city}`
    : '';

  function openPicker() {
    setStep('oblast');
    setSelectedOblast(value?.oblast ?? null);
    setSelectedCity(value?.city ?? null);
    setOpen(true);
  }

  function selectOblast(name: string) {
    impact('light');
    setSelectedOblast(name);
    setSelectedCity(null);
    setStep('city');
  }

  function selectCity(name: string) {
    impact('light');
    setSelectedCity(name);
    const city = BELARUS_CITIES.flatMap((o) => o.cities).find((c) => c.name === name);
    if (city?.districts && city.districts.length > 0) {
      setStep('district');
    } else {
      onChange({ city: name, oblast: selectedOblast!, district: undefined });
      setOpen(false);
    }
  }

  function selectDistrict(district: string) {
    impact('light');
    onChange({ city: selectedCity!, district, oblast: selectedOblast! });
    setOpen(false);
  }

  function back() {
    if (step === 'city') { setStep('oblast'); return; }
    if (step === 'district') { setStep('city'); return; }
  }

  function cancel() { setOpen(false); }

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        className="w-full bg-[#f4f4f6] text-slate-800 placeholder-slate-400 rounded-xl p-4 border-transparent focus:ring-2 focus:ring-slate-400 focus:bg-white transition-all outline-none text-base text-left"
      >
        {value ? displayText : <span className="text-slate-400">Выберите город</span>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[60]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={sheetTransition}>
            <div className="absolute inset-0 bg-black/40 " onClick={cancel} />
            <motion.div
              className="absolute bottom-0 left-0 right-0 max-w-[430px] mx-auto bg-white rounded-t-2xl shadow-lg shadow-slate-200/50 flex flex-col max-h-[70vh]"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={sheetTransition}
            >
              <div className="flex items-center justify-between px-6 pt-5 pb-3 shrink-0">
                {step !== 'oblast' ? (
                  <button onClick={back} className="text-sm font-semibold text-slate-500">← Назад</button>
                ) : (
                  <div />
                )}
                <span className="text-sm font-bold text-slate-800">
                  {step === 'oblast' && 'Область'}
                  {step === 'city' && 'Город'}
                  {step === 'district' && 'Район'}
                </span>
                <button onClick={cancel} className="text-sm font-semibold text-slate-500">Отмена</button>
              </div>

              <div className="overflow-y-auto px-4 pb-4 space-y-1">
                {step === 'oblast' && BELARUS_CITIES.map((o) => (
                  <button
                    key={o.name}
                    onClick={() => selectOblast(o.name)}
                    className={`w-full text-left px-4 py-3.5 rounded-xl text-sm font-medium transition-all ${
                      selectedOblast === o.name
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-700 hover:bg-slate-50 active:bg-slate-100'
                    }`}
                  >
                    {o.name} область
                  </button>
                ))}

                {step === 'city' && oblast?.cities.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => selectCity(c.name)}
                    className={`w-full text-left px-4 py-3.5 rounded-xl text-sm font-medium transition-all flex items-center justify-between ${
                      selectedCity === c.name
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-700 hover:bg-slate-50 active:bg-slate-100'
                    }`}
                  >
                    <span>{c.name}</span>
                    {c.districts && c.districts.length > 0 && (
                      <span className="text-[11px] text-slate-400">районы</span>
                    )}
                  </button>
                ))}

                {step === 'district' && cityData?.districts?.map((d) => (
                  <button
                    key={d.name}
                    onClick={() => selectDistrict(d.name)}
                    className={`w-full text-left px-4 py-3.5 rounded-xl text-sm font-medium transition-all ${
                      value?.district === d.name
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-700 hover:bg-slate-50 active:bg-slate-100'
                    }`}
                  >
                    {d.name} район
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
