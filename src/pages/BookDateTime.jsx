import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { get } from '../api';
import BookingStepper from '../components/BookingStepper';
import BookingFrame from '../components/BookingFrame';
import { getAvailability } from '../services/availability';
import { getBookingDraft, saveBookingDraft } from '../utils/bookingFlowStorage';

const DEFAULT_MIN_LEAD_HOURS = 6;

// Slot times are free-text like "07:00 AM" -- combined with the
// selected date, this is the only place that needs to turn one into a
// real Date to compare against the admin-configured lead-time buffer.
function parseSlotDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  const [, hh, mm, ampm] = match;
  let hours = parseInt(hh, 10) % 12;
  if (ampm.toUpperCase() === 'PM') hours += 12;
  const [y, mo, d] = dateStr.split('-').map(Number);
  if (!y || !mo || !d) return null;
  return new Date(y, mo - 1, d, hours, parseInt(mm, 10), 0, 0);
}

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
  const [minLeadHours, setMinLeadHours] = useState(DEFAULT_MIN_LEAD_HOURS);
  const navigate = useNavigate();

  // Admin-configured minimum notice before a puja can be booked (see
  // Admin Settings -> Booking Lead Time). Fails open to the documented
  // default rather than blocking booking if this can't be read.
  useEffect(() => {
    let mounted = true;
    get('/settings/booking')
      .then((data) => {
        if (mounted && Number.isFinite(data?.min_lead_hours)) {
          setMinLeadHours(data.min_lead_hours);
        }
      })
      .catch(() => {
        /* keep the default */
      });
    return () => {
      mounted = false;
    };
  }, []);

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
          const slotDT = parseSlotDateTime(date, selectedSlot.time);
          const stillFarEnoughOut = !slotDT || slotDT >= new Date(Date.now() + minLeadHours * 3600 * 1000);
          if (!found || !stillFarEnoughOut) {
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
          <p className="mt-1 text-sm text-slate-500">
            Bookings need at least {minLeadHours} hour{minLeadHours === 1 ? '' : 's'}' notice so we can arrange your Pandit Ji.
          </p>

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
                    {slots.map((s) => {
                      const slotDT = parseSlotDateTime(date, s.time);
                      const tooSoon = Boolean(slotDT) && slotDT < new Date(Date.now() + minLeadHours * 3600 * 1000);
                      const selectable = s.available && !tooSoon;
                      return (
                        <button
                          key={s.id}
                          disabled={!selectable}
                          title={tooSoon ? `Needs at least ${minLeadHours} hours' notice` : undefined}
                          onClick={() => setSelectedSlot(s)}
                          className={`min-h-[44px] rounded-full px-3 py-2 text-sm font-medium transition ${selectable ? (selectedSlot?.id === s.id ? 'bg-maroon text-white shadow-sm' : 'border border-amber-200 bg-white text-slate-700 hover:border-maroon hover:text-maroon') : 'cursor-not-allowed bg-gray-100 text-gray-400'}`}
                        >
                          {s.time} {s.shubh ? '✨' : ''}
                        </button>
                      );
                    })}
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
              navigate('/book/address', { state: { date, slot: selectedSlot, puja } });
            }}
            className={`min-h-[44px] rounded-full px-5 py-2 font-semibold text-white shadow-sm transition ${!selectedSlot || isPast(date) ? 'bg-gray-300' : 'bg-saffron hover:opacity-90'}`}
          >
            Next: Address
          </button>
          <button onClick={() => navigate(-1)} className="min-h-[44px] rounded-full border border-amber-200 bg-white px-5 py-2 text-slate-700">Back</button>
        </div>
      </div>
    </BookingFrame>
  );
}