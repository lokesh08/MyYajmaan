import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import BookingStepper from '../components/BookingStepper';
import BookingFrame from '../components/BookingFrame';
import ThemeDialog from '../components/ThemeDialog';
import ThemeNotice from '../components/ThemeNotice';

export default function BookAddress() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    city: 'Varanasi',
    pin: '',
    note: '',
  });
  const [dialog, setDialog] = useState({ open: false, title: '', message: '' });
  const [notice, setNotice] = useState('');

  const { date, slot, puja, pandit } = state || {};

  if (!date || !slot || !pandit) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-slate-600">Incomplete booking data. Please complete the earlier steps first.</p>
      </section>
    );
  }

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setNotice('');
  }

  function handleNext() {
    if (!form.name || !form.phone || !form.address || !form.pin) {
      setNotice('Please fill in your name, phone, address, and pin code before continuing.');
      return;
    }

    navigate('/book/payment', {
      state: {
        date,
        slot,
        puja,
        pandit,
        address: form,
      },
    });
  }

  return (
    <BookingFrame
      title="Address & Contact"
      description="Enter the address and contact details for your puja."
      accentImage={puja?.image || undefined}
      asideTitle="Service summary"
      asideItems={[
        { label: `Ritual: ${puja?.title || 'Selected puja'}` },
        { label: `Pandit: ${pandit?.name || 'Selected priest'}` },
        { label: `Date: ${date}` },
      ]}
    >
      <BookingStepper currentStep={4} />
      <p className="mt-2 text-sm text-slate-600">Ritual: <strong>{puja?.title || 'Selected puja'}</strong></p>

      <div className="mt-6">
        <div className="grid gap-4 md:grid-cols-2">
          <input value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Full name" className="rounded-[1.1rem] border border-amber-100 bg-gradient-to-r from-amber-50/70 to-white px-3 py-2 shadow-sm" />
          <input value={form.phone} onChange={(e) => updateField('phone', e.target.value)} placeholder="Mobile number" className="rounded-[1.1rem] border border-amber-100 bg-gradient-to-r from-amber-50/70 to-white px-3 py-2 shadow-sm" />
          <input value={form.city} onChange={(e) => updateField('city', e.target.value)} placeholder="City" className="rounded-[1.1rem] border border-amber-100 bg-gradient-to-r from-amber-50/70 to-white px-3 py-2 shadow-sm" />
          <input value={form.pin} onChange={(e) => updateField('pin', e.target.value)} placeholder="Pin code" className="rounded-[1.1rem] border border-amber-100 bg-gradient-to-r from-amber-50/70 to-white px-3 py-2 shadow-sm" />
        </div>

        <textarea
          value={form.address}
          onChange={(e) => updateField('address', e.target.value)}
          placeholder="House/Flat number, street, locality"
          className="mt-4 min-h-28 w-full rounded-[1.1rem] border border-amber-100 bg-gradient-to-r from-amber-50/70 to-white px-3 py-2 shadow-sm"
        />

        <textarea
          value={form.note}
          onChange={(e) => updateField('note', e.target.value)}
          placeholder="Special instructions for the priest / puja timing"
          className="mt-4 min-h-24 w-full rounded-[1.1rem] border border-amber-100 bg-gradient-to-r from-amber-50/70 to-white px-3 py-2 shadow-sm"
        />

        {notice && <ThemeNotice type="error" title="Need a quick check" message={notice} />}

        <div className="mt-6 flex gap-3">
          <button onClick={handleNext} className="rounded-full bg-saffron px-5 py-2 font-semibold text-white shadow-sm transition hover:opacity-90">Next: Payment</button>
          <button onClick={() => navigate(-1)} className="rounded-full border border-amber-200 bg-white px-5 py-2 text-slate-700">Back</button>
        </div>
      </div>

      <ThemeDialog
        open={dialog.open}
        title={dialog.title}
        message={dialog.message}
        onClose={() => setDialog((prev) => ({ ...prev, open: false }))}
      />
    </BookingFrame>
  );
}
