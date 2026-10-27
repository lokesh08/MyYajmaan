import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BookingStepper from '../components/BookingStepper';
import BookingFrame from '../components/BookingFrame';
import SelectionCard from '../components/SelectionCard';
import { fetchAvailablePandits } from '../services/pandits';
import { getBookingDraft, saveBookingDraft } from '../utils/bookingFlowStorage';

export default function SelectPandit() {
  const { state } = useLocation();
  const navigate = useNavigate();

  const draft = getBookingDraft();
  const preserved = state?.date ? state : draft;
  const date = preserved?.date;
  const slot = preserved?.slot;
  const address = preserved?.address;
  const puja = preserved?.puja || { id: 1, title: 'Grah Shanti' };

  const [pandits, setPandits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(() => draft.pandit || null);

  // Load available pandits for date & slot (with cancellation)
  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    async function load() {
      // If no date/slot, nothing to fetch
      if (!date || !slot) {
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
        const res = await fetchAvailablePandits(puja.id, date, slot.time, { city: address?.city, signal: controller.signal });
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
  }, [date, slot?.time, puja.id, address?.city]);

  useEffect(() => {
    saveBookingDraft({ puja, date, slot, pandit: selected });
  }, [puja, date, slot, selected]);

  if (!date || !slot || !address) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-slate-600">Incomplete booking data. Please complete the earlier steps first.</p>
      </section>
    );
  }

  return (
    <BookingFrame
      title="Select Pandit Ji"
      description="Choose a trusted priest for your selected date and time slot."
      accentImage={puja.image || undefined}
      asideTitle="Your match summary"
      asideItems={[
        { label: `Ritual: ${puja.title}` },
        { label: `Date: ${date}` },
        { label: `Time: ${slot.time}` },
      ]}
    >
      <BookingStepper currentStep={4} />
      <p className="mt-2 text-sm text-slate-600">Ritual: <strong>{puja.title}</strong></p>
      <p className="mt-1 text-sm text-slate-600">Selected: <strong>{date}</strong> • <strong>{slot.time}</strong></p>

      <div className="mt-6 space-y-4">
        {loading && <p className="text-sm text-slate-500">Loading available pandits…</p>}

        {!loading && error && (
          <p className="text-sm text-red-600">Failed to load available pandits. Please try again.</p>
        )}

        {!loading && !error && pandits.length === 0 && (
          <p className="text-sm text-slate-500">
            {address?.city
              ? `No Pandit Ji available in ${address.city} for this date/time. Try a different date, time, or address.`
              : 'No pandits available for the selected date/time.'}
          </p>
        )}

        {!loading && pandits.map((p) => (
          <SelectionCard
            key={p.id}
            ariaLabel={`Select ${p.name}`}
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
                  <p className="text-sm text-slate-500">{(p.languages || []).join(', ')} • {p.experience} yrs{p.city ? ` • ${p.city}` : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-semibold text-maroon">₹{p.price}</p>
                  <p className="text-sm text-amber-500">⭐ {p.rating}</p>
                </div>
                <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${selected?.id === p.id ? 'bg-maroon text-white shadow-sm' : 'bg-amber-50 text-slate-700 group-hover:bg-maroon group-hover:text-white'}`}>
                  {selected?.id === p.id ? 'Selected' : 'Select'}
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
          className={`rounded-full px-5 py-2 font-semibold text-white shadow-sm ${!selected ? 'bg-gray-300' : 'bg-saffron'}`}
        >
          Next: Payment
        </button>
        <button onClick={() => navigate(-1)} className="rounded-full border px-5 py-2">Back</button>
      </div>
    </BookingFrame>
  );
}