import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import BookingStepper from '../components/BookingStepper';
import BookingFrame from '../components/BookingFrame';
import ThemeDialog from '../components/ThemeDialog';
import { initiatePayment, verifyPayment } from '../services/payments';
import { createBooking } from '../services/bookings';

export default function BookPayment() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [method, setMethod] = useState('upi');
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState({ open: false, title: '', message: '' });

  const { date, slot, puja, pandit, address } = state || {};

  if (!date || !slot || !pandit) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-slate-600">Incomplete booking data. Go back and complete earlier steps.</p>
      </section>
    );
  }

  const amount = pandit.price;

  async function handlePay() {
    setLoading(true);
    try {
      const session = await initiatePayment({ amount, method });
      // Simulate redirect to payment and verify
      const verification = await verifyPayment(session.sessionId);
      if (verification.status === 'success') {
        const booking = await createBooking({ pujaId: puja?.id || 1, panditId: pandit.id, date, timeslot: slot.time, amount, paymentRef: verification.sessionId });
        navigate('/book/confirmation', { state: { booking, address, puja, pandit } });
      } else {
        setDialog({ open: true, title: 'Payment failed', message: 'The payment did not complete successfully. Please try again.' });
      }
    } catch (err) {
      console.error(err);
      setDialog({ open: true, title: 'Payment error', message: 'Something went wrong while processing your payment. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <BookingFrame
      title="Payment"
      description="Review your booking and choose a payment method."
      accentImage={puja?.image || undefined}
      asideTitle="Booking review"
      asideItems={[
        { label: `Ritual: ${puja?.title || 'Selected puja'}` },
        { label: `Pandit: ${pandit.name}` },
        { label: `Amount: ₹${amount}` },
      ]}
    >
      <BookingStepper currentStep={5} />
      <div className="mt-6">
        <div className="flex items-center justify-between rounded-[1.25rem] border border-amber-100 bg-gradient-to-r from-amber-50 via-white to-amber-50/70 p-4 shadow-sm">
          <div>
            <p className="font-semibold">{pandit.name}</p>
            <p className="text-sm text-slate-500">{date} • {slot.time}</p>
            <p className="mt-1 text-sm text-slate-500">{address?.city}, {address?.pin}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-maroon">₹{amount}</p>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700">Payment Method</label>
          <div className="mt-2 flex gap-2">
            <button onClick={() => setMethod('upi')} className={`rounded-full px-3 py-2 font-medium ${method === 'upi' ? 'bg-maroon text-white shadow-sm' : 'border border-amber-200 bg-white text-slate-700'}`}>UPI</button>
            <button onClick={() => setMethod('card')} className={`rounded-full px-3 py-2 font-medium ${method === 'card' ? 'bg-maroon text-white shadow-sm' : 'border border-amber-200 bg-white text-slate-700'}`}>Card</button>
            <button onClick={() => setMethod('wallet')} className={`rounded-full px-3 py-2 font-medium ${method === 'wallet' ? 'bg-maroon text-white shadow-sm' : 'border border-amber-200 bg-white text-slate-700'}`}>Wallet</button>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={handlePay} disabled={loading} className="rounded-full bg-saffron px-5 py-2 font-semibold text-white shadow-sm transition hover:opacity-90">{loading ? 'Processing…' : `Pay ₹${amount}`}</button>
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
