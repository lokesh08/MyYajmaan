import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BookingStepper from '../components/BookingStepper';
import BookingFrame from '../components/BookingFrame';
import { getAvailability } from '../services/availability';

export default function BookDateTime() {
  const { state } = useLocation();
  const puja = state?.puja || { id: 1, title: 'Grah Shanti' };
  const [date, setDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [availability, setAvailability] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    getAvailability(puja.id, date).then((res) => {
      if (mounted) setAvailability(res.slots);
    });
    return () => (mounted = false);
  }, [date, puja.id]);

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
          {!availability && <p className="mt-2 text-sm text-slate-500">Loading availability…</p>}
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
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            disabled={!selectedSlot || isPast(date)}
            onClick={() => navigate('/book/select-pandit', { state: { date, slot: selectedSlot, puja } })}
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
