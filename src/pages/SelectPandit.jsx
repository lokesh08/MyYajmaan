import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import BookingStepper from '../components/BookingStepper';
import BookingFrame from '../components/BookingFrame';
import SelectionCard from '../components/SelectionCard';
import { fetchAvailablePandits } from '../services/pandits';
import { getBookingDraft, saveBookingDraft } from '../utils/bookingFlowStorage';
import { missingStepPath, resolveBookingData, stepNumber } from '../utils/bookingSteps';
import { t } from "../i18n";

export default function SelectPandit() {
  const { state } = useLocation();
  const navigate = useNavigate();

  const draft = getBookingDraft();
  const preserved = resolveBookingData(state, draft);
  const date = preserved.date;
  const slot = preserved.slot;
  const address = preserved.address;
  const puja = preserved.puja;
  const missingPath = missingStepPath('pandit', preserved);

  const [pandits, setPandits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(() => draft.pandit || null);

  // Load available pandits for date & slot (with cancellation)
  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    async function load() {
      // Earlier step missing (redirecting below) -- nothing to fetch
      if (missingPath) {
        if (mounted) {
          setPandits([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError(null);
      setPandits([]);

      try {
        // Server/Supabase now filters to only pandits who actually
        // offer this puja and prices them at exactly what they charge
        // for it (pandit_puja.price_override, falling back to the
        // puja's base_price) -- no more generic-price fallback needed,
        // p.price is always the real per-puja price when present at all.
        const res = await fetchAvailablePandits(puja?.id, date, slot.time, { city: address?.city, signal: controller.signal });
        if (!mounted) return;

        const rows = Array.isArray(res?.pandits) ? res.pandits : [];
        setPandits(rows);
        setLoading(false);

        // If current selection is not in the new list, clear it
        if (selected && !rows.some((p) => p.id === selected.id)) {
          setSelected(null);
        }
      } catch (err) {
        if (err?.name === 'CanceledError' || err?.isCanceled) {
          // request aborted - ignore
          return;
        }
        console.error('Failed to fetch available pandits', err);
        if (mounted) {
          // Fall back to mock may already be returned by service; if not, show error
          setPandits((prev) => prev || []);
          setError(err);
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
      controller.abort();
    };
    // Note: selected intentionally not in deps to avoid clearing selection while user interacts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, slot?.time, puja?.id, address?.city]);

  useEffect(() => {
    if (missingPath) return;
    saveBookingDraft({ puja, date, slot, pandit: selected });
  }, [puja, date, slot, selected, missingPath]);

  if (missingPath) {
    return <Navigate to={missingPath} replace state={puja ? { puja } : undefined} />;
  }

  return (
    <BookingFrame
      title={t("Select Pandit Ji")}
      description={t("Choose a trusted priest for your selected date and time slot.")}
      accentImage={puja.image || undefined}
      asideTitle={t("Your match summary")}
      asideItems={[
        { label: t("Ritual: {value}", { value: puja.title }) },
        { label: t("Date: {value}", { value: date }) },
        { label: t("Time: {value}", { value: slot.time }) },
      ]}
    >
      <BookingStepper currentStep={stepNumber('pandit', puja)} />
      <p className="mt-2 text-sm text-slate-600">{t("Ritual:")}{' '}<strong>{t(puja.title)}</strong></p>
      <p className="mt-1 text-sm text-slate-600">{t("Selected:")}{' '}<strong>{date}</strong> • <strong>{slot.time}</strong></p>

      <div className="mt-6 space-y-4">
        {loading && <p className="text-sm text-slate-500">{t("Loading available pandits…")}</p>}

        {!loading && error && (
          <p className="text-sm text-red-600">{t("Failed to load available pandits. Please try again.")}</p>
        )}

        {!loading && !error && pandits.length === 0 && (
          <p className="text-sm text-slate-500">
            {address?.city
              ? t("No Pandit Ji available in {city} for this date/time. Try a different date, time, or address.", { city: address.city })
              : t("No pandits available for the selected date/time.")}
          </p>
        )}

        {!loading && pandits.map((p) => (
          <SelectionCard
            key={p.id}
            ariaLabel={t("Select {name}", { name: p.name })}
            ariaPressed={selected?.id === p.id}
            selected={selected?.id === p.id}
            onClick={() => setSelected(p)}
            className="p-4"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-maroon to-saffron text-xl font-semibold text-white">👳</div>
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-sm text-slate-500">{(p.languages || []).join(', ')} • {p.experience}{' '}{t("yrs")}{p.city ? ` • ${p.city}` : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-semibold text-maroon">₹{p.price}</p>
                  <p className="text-sm text-amber-500">⭐ {p.rating}</p>
                </div>
                <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${selected?.id === p.id ? 'bg-maroon text-white shadow-sm' : 'bg-amber-50 text-slate-700 group-hover:bg-maroon group-hover:text-white'}`}>
                  {selected?.id === p.id ? t("Selected") : t("Select")}
                </span>
              </div>
            </div>
          </SelectionCard>
        ))}
      </div>

      <div className="mt-6 flex gap-3">
        <button
          disabled={!selected}
          onClick={() => {
            saveBookingDraft({ puja, date, slot, pandit: selected, address });
            navigate('/book/payment', { state: { date, slot, puja, pandit: selected, address } });
          }}
          className={`min-h-[44px] rounded-full px-5 py-2 font-semibold text-white shadow-sm ${!selected ? 'bg-gray-300' : 'bg-saffron'}`}
        >
          {t("Next: Payment")}
        </button>
        <button onClick={() => navigate(-1)} className="min-h-[44px] rounded-full border px-5 py-2">{t("Back")}</button>
      </div>
    </BookingFrame>
  );
}