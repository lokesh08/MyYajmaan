// Order matches utils/bookingSteps.js (the address is chosen first).
const NORMAL_STEPS = [
  'Puja',
  'Address',
  'Date & Time',
  'Pandit',
  'Payment',
  'Confirmation',
];

// A package puja has no Pandit-picker or Payment step at booking time
// (admin assigns a Pandit Ji and payment only happens after a quote) --
// see BookPackageDetails.jsx/BookPackageConfirmation.jsx.
export const PACKAGE_STEPS = [
  'Puja',
  'Address',
  'Date & Time',
  'Requirements',
  'Submitted',
];

export default function BookingStepper({ currentStep = 1, steps = NORMAL_STEPS }) {
  return (
    <>
      {/* Phones: "Step 2 of 6 · Date & Time" plus a segmented bar -- the
          six-pill row below is ~830px wide and scrolled the current step
          out of view on a phone. */}
      <div className="mb-5 sm:hidden">
        <p className="text-sm font-semibold text-maroon">
          Step {currentStep} of {steps.length}
          <span className="font-normal text-slate-500"> · {steps[currentStep - 1]}</span>
        </p>
        <div
          className="mt-2 flex gap-1"
          role="progressbar"
          aria-label="Booking progress"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={currentStep}
        >
          {steps.map((step, index) => (
            <span
              key={step}
              className={`h-1.5 flex-1 rounded-full ${
                index + 1 < currentStep ? 'bg-emerald-400' : index + 1 === currentStep ? 'bg-maroon' : 'bg-amber-100'
              }`}
            />
          ))}
        </div>
      </div>

      <StepperPills currentStep={currentStep} steps={steps} />
    </>
  );
}

function StepperPills({ currentStep, steps }) {
  return (
    <div className="mb-6 hidden overflow-x-auto sm:block">
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
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${circleClass}`}>
                  {isComplete ? '✓' : index + 1}
                </div>
                <span className={`text-xs font-semibold tracking-wide ${isActive ? 'text-maroon' : isComplete ? 'text-emerald-700' : 'text-slate-600'}`}>
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
