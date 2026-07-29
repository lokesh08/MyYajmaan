import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BookingStepper from '../components/BookingStepper';
import BookingFrame from '../components/BookingFrame';
import { fetchAvailablePandits } from '../services/pandits';

export default function SelectPandit() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [pandits, setPandits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const date = state?.date;
  const slot = state?.slot;
  const puja = state?.puja || { id: 1, title: 'Grah Shanti' };

  useEffect(() => {
    let mounted = true;
    if (!date || !slot) return;
    fetchAvailablePandits(puja.id, date, slot.time).then((res) => {
      if (mounted) {
        setPandits(res.pandits);
        setLoading(false);
      }
    });
    return () => (mounted = false);
  }, [date, slot]);

  if (!date || !slot) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-slate-600">No date/time selected. Please choose a slot first.</p>
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
      <BookingStepper currentStep={3} />
      <p className="mt-2 text-sm text-slate-600">Ritual: <strong>{puja.title}</strong></p>
      <p className="mt-1 text-sm text-slate-600">Selected: <strong>{date}</strong> • <strong>{slot.time}</strong></p>

      <div className="mt-6 space-y-4">
        {loading && <p className="text-sm text-slate-500">Loading available pandits…</p>}

        {!loading && pandits.map((p) => (
          <div key={p.id} className={`flex items-center justify-between gap-4 rounded-[1.25rem] border p-4 transition ${selected?.id === p.id ? 'border-maroon bg-amber-50/70 shadow-sm' : 'border-amber-100 bg-white'}`}>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-maroon to-saffron text-xl font-semibold text-white">👳</div>
              <div>
                <p className="font-semibold">{p.name}</p>
                <p className="text-sm text-slate-500">{p.languages.join(', ')} • {p.experience} yrs</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-semibold text-maroon">₹{p.price}</p>
                <p className="text-sm text-amber-500">⭐ {p.rating}</p>
              </div>
              <div>
                <button onClick={() => setSelected(p)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${selected?.id === p.id ? 'bg-maroon text-white' : 'border border-amber-200 bg-white text-slate-700'}`}>
                  {selected?.id === p.id ? 'Selected' : 'Select'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex gap-3">
        <button
          disabled={!selected}
          onClick={() => navigate('/book/address', { state: { date, slot, puja, pandit: selected } })}
          className={`rounded-full px-5 py-2 font-semibold text-white shadow-sm ${!selected ? 'bg-gray-300' : 'bg-saffron'}`}
        >
          Next: Address
        </button>
        <button onClick={() => navigate(-1)} className="rounded-full border px-5 py-2">Back</button>
      </div>
    </BookingFrame>
  );
}
