import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

const PUJAS_MIN = 2;
const PUJAS_MAX = 30;
const FEE_MIN = 500;
const FEE_MAX = 5000;
const FEE_STEP = 100;

const TIERS = [
  { max: 6, label: "Getting Started", className: "bg-amber-50 text-amber-700 border-amber-200" },
  { max: 14, label: "Growing Pandit Ji", className: "bg-orange-50 text-saffron border-orange-200" },
  { max: 22, label: "Popular Pandit Ji", className: "bg-rose-50 text-maroon border-rose-200" },
  { max: Infinity, label: "Top Pandit Ji", className: "bg-gradient-to-r from-saffron to-gold text-white border-transparent" },
];

function getTier(pujasPerMonth) {
  return TIERS.find((tier) => pujasPerMonth <= tier.max);
}

function formatRupees(value) {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

/** Eases a displayed number toward `target` for a satisfying "ticking" feel
 * instead of the total just snapping when a slider moves. */
function useAnimatedNumber(target, durationMs = 350) {
  const [displayed, setDisplayed] = useState(target);
  const frameRef = useRef(null);
  const startRef = useRef({ value: target, time: 0 });

  useEffect(() => {
    startRef.current = { value: displayed, time: performance.now() };
    cancelAnimationFrame(frameRef.current);

    function tick(now) {
      const elapsed = now - startRef.current.time;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - (1 - progress) * (1 - progress); // ease-out
      const next = startRef.current.value + (target - startRef.current.value) * eased;
      setDisplayed(next);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return displayed;
}

function SliderRow({ label, value, min, max, step = 1, onChange, formatValue, id }) {
  const percent = ((value - min) / (max - min)) * 100;

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-600">{label}</span>
        <span className="rounded-full bg-white px-3 py-1 font-serif text-base font-bold text-maroon shadow-sm">
          {formatValue(value)}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
        className="earnings-slider mt-3"
        style={{ background: `linear-gradient(to right, var(--color-saffron) 0%, var(--color-saffron) ${percent}%, var(--color-parchment-400) ${percent}%, var(--color-parchment-400) 100%)` }}
      />
    </div>
  );
}

/**
 * Shared by the Pandit Ji register and login pages -- a lightweight,
 * self-contained "what could I earn here" calculator meant to turn
 * browsing into a registration. Pure front-end estimate (pujas/month
 * x fee/puja); no claims about guaranteed bookings or timelines are
 * made in the copy, since neither is something this app can promise.
 */
export default function EarningsCalculatorCard({ ctaLabel = "Register as Pandit Ji →", onCtaClick }) {
  const [pujasPerMonth, setPujasPerMonth] = useState(12);
  const [feePerPuja, setFeePerPuja] = useState(1500);

  const monthly = pujasPerMonth * feePerPuja;
  const yearly = monthly * 12;
  const animatedMonthly = useAnimatedNumber(monthly);
  const tier = getTier(pujasPerMonth);

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-amber-100 bg-white shadow-float">
      <style>{`
        .earnings-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 8px;
          border-radius: 9999px;
          outline: none;
          cursor: pointer;
        }
        .earnings-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          height: 24px;
          width: 24px;
          border-radius: 9999px;
          background: linear-gradient(135deg, var(--color-saffron), var(--color-maroon));
          border: 3px solid var(--color-white);
          box-shadow: var(--shadow-thumb);
          cursor: pointer;
          transition: transform 0.15s ease;
        }
        .earnings-slider::-webkit-slider-thumb:hover { transform: scale(1.15); }
        .earnings-slider::-moz-range-thumb {
          height: 24px;
          width: 24px;
          border-radius: 9999px;
          background: linear-gradient(135deg, var(--color-saffron), var(--color-maroon));
          border: 3px solid var(--color-white);
          box-shadow: var(--shadow-thumb);
          cursor: pointer;
        }
        .earnings-slider::-moz-range-track { background: transparent; }
        @keyframes earnings-glow {
          0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-saffron) 45%, transparent); }
          50% { box-shadow: 0 0 0 12px color-mix(in srgb, var(--color-saffron) 0%, transparent); }
        }
        .earnings-cta { animation: earnings-glow 2.2s ease-in-out infinite; }
      `}</style>

      {/* ambient glow, matching the header's diya-light motif elsewhere in the app */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-saffron/20 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 -bottom-16 h-56 w-56 rounded-full bg-maroon/10 blur-3xl" />

      <div className="relative p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-saffron">For Pandit Ji</p>
          <span className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${tier.className}`}>
            {tier.label}
          </span>
        </div>

        <h2 className="mt-2 font-serif text-2xl font-semibold text-maroon sm:text-3xl">
          Calculate Your Earnings Potential 🪔
        </h2>
        <p className="mt-1 text-sm text-slate-500">See what you could earn performing pujas with MyYajmaan.</p>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <SliderRow
            id="pujas-per-month"
            label="Pujas Per Month"
            value={pujasPerMonth}
            min={PUJAS_MIN}
            max={PUJAS_MAX}
            onChange={setPujasPerMonth}
            formatValue={(v) => v}
          />
          <SliderRow
            id="fee-per-puja"
            label="Fee Per Puja"
            value={feePerPuja}
            min={FEE_MIN}
            max={FEE_MAX}
            step={FEE_STEP}
            onChange={setFeePerPuja}
            formatValue={formatRupees}
          />
        </div>

        <div className="mt-7 rounded-2xl bg-gradient-to-br from-parchment-100 to-parchment-250 p-5 text-center sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
            Your Monthly Earnings Potential
          </p>
          <p className="mt-1 font-serif text-4xl font-extrabold text-maroon sm:text-5xl">
            {formatRupees(animatedMonthly)}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-500">
            that's <span className="font-semibold text-saffron">{formatRupees(yearly)}</span> a year with MyYajmaan
          </p>
        </div>

        <div className="mt-6 flex flex-col items-center gap-2">
          {onCtaClick ? (
            <button
              type="button"
              onClick={onCtaClick}
              title="Register as Pandit Ji"
              className="earnings-cta interactive-button w-full rounded-full bg-gradient-to-r from-saffron to-sand px-6 py-3.5 text-center font-semibold text-maroon shadow-lg sm:w-auto sm:px-10"
            >
              {ctaLabel}
            </button>
          ) : (
            <Link
              to="/pandit/register"
              title="Register as Pandit Ji"
              className="earnings-cta interactive-button w-full rounded-full bg-gradient-to-r from-saffron to-sand px-6 py-3.5 text-center font-semibold text-maroon shadow-lg sm:w-auto sm:px-10"
            >
              {ctaLabel}
            </Link>
          )}
          <p className="text-xs text-slate-400">Free to join. Get matched with families looking for a trusted Pandit Ji.</p>
        </div>
      </div>
    </div>
  );
}
