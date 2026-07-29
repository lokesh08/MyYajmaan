const steps = [
  'Puja',
  'Date & Time',
  'Pandit',
  'Address',
  'Payment',
  'Confirmation',
];

export default function BookingStepper({ currentStep = 1 }) {
  return (
    <div className="mb-6 overflow-x-auto">
      <div className="flex min-w-max items-center gap-2 rounded-full border border-amber-100 bg-gradient-to-r from-amber-50/80 via-white to-amber-50/70 px-2 py-2 shadow-sm">
        {steps.map((step, index) => {
          const isActive = index + 1 === currentStep;
          const isComplete = index + 1 < currentStep;
          const circleClass = isActive
            ? 'bg-maroon text-white shadow-md'
            : isComplete
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-white text-slate-500 ring-1 ring-amber-100';

          return (
            <div key={step} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 rounded-full px-2.5 py-1.5 ${isActive ? 'bg-white/80' : 'bg-white/60'}`}>
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${circleClass}`}>
                  {isComplete ? '✓' : index + 1}
                </div>
                <span className={`text-[11px] font-semibold tracking-wide ${isActive ? 'text-maroon' : isComplete ? 'text-emerald-700' : 'text-slate-600'}`}>
                  {step}
                </span>
              </div>
              {index < steps.length - 1 && <span className="text-[12px] text-slate-400">›</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
