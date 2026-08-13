import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BookingStepper from '../components/BookingStepper';
import BookingFrame from '../components/BookingFrame';
import { getAvailability } from '../services/availability';
import { getBookingDraft, saveBookingDraft } from '../utils/bookingFlowStorage';

export default function BookDateTime() {
  const { state } = useLocation();
  const draft = getBookingDraft();
  const preserved = state?.puja ? state : draft;
  const puja = preserved?.puja || { id: 1, title: 'Grah Shanti' };

  const [date, setDate] = useState(() => preserved?.date || new Date().toISOString().slice(0, 10));
  const [availability, setAvailability] = useState(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState(null);

  const [selectedSlot, setSelectedSlot] = useState(() => preserved?.slot || null);
  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    async function loadAvailability() {
      setLoadingAvailability(true);
      setAvailability(null);
      setAvailabilityError(null);

      try {
        const res = await getAvailability(puja.id, date, { signal: controller.signal });
        if (!mounted) return;
        // getAvailability returns { date, pujaId, slots }
        setAvailability(res?.slots ?? null);

        // Optionally: if previously selected slot is not available on new date, clear it
        if (selectedSlot) {
          const found = Object.values(res?.slots ?? {}).some((group) =>
            group.some((s) => s.id === selectedSlot.id)
          );
          if (!found) {
            setSelectedSlot(null);
          }
        }
      } catch (err) {
        if (err?.name === 'CanceledError' || err?.isCanceled) {
          // request was aborted - ignore
          return;
        }
        console.error('Failed to load availability', err);
        setAvailabilityError(err);
        // If getAvailability falls back to mock internally, availability will be set above.
        // If it threw, we keep availability null so UI shows an error or empty state.
      } finally {
        if (mounted) setLoadingAvailability(false);
      }
    }

    loadAvailability();

    return () => {
      mounted = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, puja.id]);

  useEffect(() => {
    saveBookingDraft({ puja, date, slot: selectedSlot });
  }, [puja, date, selectedSlot]);

  function isPast(selectedDate) {
    const today = new Date();
    const d = new Date(selectedDate + 'T00:00:00');
    return d.setHours(0, 0, 0, 0) < today.setHours(0, 0, 0, 0);
  }

  return (
    <BookingFrame
      title="Select date & time"
      description="Choose a convenient date and available time slot for your puja."
      accentImage={puja.image || undefined}
      asideTitle="Puja summary"
      asideItems={[
        { label: `Ritual: ${puja.title}` },
        { label: 'Verified priest availability' },
        { label: 'Shubh muhurat friendly slots' },
      ]}
    >
      <BookingStepper currentStep={2} />
      <p className="mt-2 text-sm text-slate-600">Selected ritual: <strong>{puja.title}</strong></p>

      <div className="mt-6">
        <label className="block text-sm font-medium text-slate-700">Select Date</label>
        <div className="mt-2 rounded-[1.1rem] border border-amber-100 bg-gradient-to-r from-amber-50 via-white to-amber-50/70 p-3 shadow-sm">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm"
          />
        </div>
        {isPast(date) && <p className="mt-2 text-sm text-red-600">Please select a future date.</p>}

        <div className="mt-6">
          <h3 className="font-semibold text-slate-700">Available Time Slots</h3>

          {loadingAvailability && <p className="mt-2 text-sm text-slate-500">Loading availability…</p>}

          {!loadingAvailability && availabilityError && (
            <p className="mt-2 text-sm text-red-600">Failed to load availability. Please try again.</p>
          )}

          {availability && (
            <div className="mt-3 space-y-4">
              {Object.entries(availability).map(([group, slots]) => (
                <div key={group}>
                  <p className="mb-2 text-sm font-semibold capitalize text-slate-600">{group}</p>
                  <div className="flex flex-wrap gap-2">
                    {slots.map((s) => (
                      <button
                        key={s.id}
                        disabled={!s.available}
                        onClick={() => setSelectedSlot(s)}
                        className={`rounded-full px-3 py-2 text-sm font-medium transition ${s.available ? (selectedSlot?.id === s.id ? 'bg-maroon text-white shadow-sm' : 'border border-amber-200 bg-white text-slate-700 hover:border-maroon hover:text-maroon') : 'cursor-not-allowed bg-gray-100 text-gray-400'}`}
                      >
                        {s.time} {s.shubh ? '✨' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loadingAvailability && !availability && !availabilityError && (
            <p className="mt-2 text-sm text-slate-500">No slots available for the selected date.</p>
          )}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            disabled={!selectedSlot || isPast(date)}
            onClick={() => {
              saveBookingDraft({ puja, date, slot: selectedSlot });
              navigate('/book/select-pandit', { state: { date, slot: selectedSlot, puja } });
            }}
            className={`rounded-full px-5 py-2 font-semibold text-white shadow-sm transition ${!selectedSlot || isPast(date) ? 'bg-gray-300' : 'bg-saffron hover:opacity-90'}`}
          >
            Next
          </button>
          <button onClick={() => navigate(-1)} className="rounded-full border border-amber-200 bg-white px-5 py-2 text-slate-700">Back</button>
        </div>
      </div>
    </BookingFrame>
  );
}