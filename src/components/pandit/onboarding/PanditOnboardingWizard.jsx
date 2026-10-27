import { useEffect, useState } from "react";

import { getPanditProfile } from "../../../services/panditApi";
import BasicInfoStep from "./BasicInfoStep";
import ServicesStep from "./ServicesStep";
import DocumentsStep from "./DocumentsStep";

const STEPS = [
  { key: 1, label: "Basic Information" },
  { key: 2, label: "Services & Pricing" },
  { key: 3, label: "Documents" },
];

function SuccessScreen({ onDone }) {
  return (
    <div className="rounded-[1.5rem] border border-amber-100 bg-white p-10 text-center shadow-sm">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-3xl text-emerald-500">
        ✓
      </div>
      <h2 className="mt-5 font-serif text-2xl font-semibold text-maroon">Registration Submitted!</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        Thank you for registering as a Pandit Ji with MyYajmaan. Our team will review your details and documents
        shortly. You'll be notified once your profile is approved.
      </p>
      <button
        type="button"
        onClick={onDone}
        className="interactive-button mt-6 rounded-full bg-maroon px-6 py-2.5 text-sm font-semibold text-white hover:bg-maroon"
      >
        Go to My Status
      </button>
    </div>
  );
}

export default function PanditOnboardingWizard({ onCompleted }) {
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    getPanditProfile()
      .then((data) => setProfile(data?.pandit || null))
      .catch(() => {});
  }, []);

  if (submitted) {
    return <SuccessScreen onDone={onCompleted} />;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-center gap-2 sm:gap-4">
        {STEPS.map((item, index) => (
          <div key={item.key} className="flex items-center gap-2 sm:gap-4">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition ${
                  step === item.key
                    ? "bg-maroon text-white"
                    : step > item.key
                      ? "bg-emerald-500 text-white"
                      : "border border-amber-200 bg-white text-slate-400"
                }`}
              >
                {step > item.key ? "✓" : item.key}
              </div>
              <span className={`hidden text-xs font-medium sm:block ${step === item.key ? "text-maroon" : "text-slate-400"}`}>
                {item.label}
              </span>
            </div>
            {index < STEPS.length - 1 && <div className="h-px w-8 bg-amber-200 sm:w-16" />}
          </div>
        ))}
      </div>

      <div className="rounded-[1.5rem] border border-amber-100 bg-white p-5 shadow-sm sm:p-8">
        <h2 className="mb-5 font-serif text-xl font-semibold text-maroon">{STEPS[step - 1].label}</h2>

        {step === 1 && (
          <BasicInfoStep
            initialValue={profile}
            onNext={(saved) => {
              setProfile(saved);
              setStep(2);
            }}
          />
        )}

        {step === 2 && <ServicesStep onNext={() => setStep(3)} onBack={() => setStep(1)} />}

        {step === 3 && <DocumentsStep onNext={() => setSubmitted(true)} onBack={() => setStep(2)} />}
      </div>
    </div>
  );
}
