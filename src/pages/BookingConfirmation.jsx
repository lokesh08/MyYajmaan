import { useLocation, Link } from 'react-router-dom';
import BookingStepper from '../components/BookingStepper';
import BookingFrame from '../components/BookingFrame';
import SummaryTile from '../components/SummaryTile';
import { clearBookingDraft } from '../utils/bookingFlowStorage';

export default function BookingConfirmation() {
  const { state } = useLocation();
  const booking = state?.booking;
  const address = state?.address;
  const puja = state?.puja;
  const pandit = state?.pandit;

  if (!booking) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-slate-600">No booking found. Please complete a booking first.</p>
      </section>
    );
  }

  return (
    <BookingFrame
      title="Booking Confirmed"
      description="Your puja request has been successfully reserved with the selected priest and timing."
      accentImage={puja?.image || undefined}
      asideTitle="Confirmation summary"
      asideItems={[
        { label: `Booking ID: ${booking.id}` },
        { label: `Ritual: ${puja?.title || 'Selected puja'}` },
        { label: `Amount: ₹${booking.amount}` },
      ]}
    >
      <BookingStepper currentStep={6} />
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600 shadow-sm">
          ✓
        </div>
        <h2 className="mt-4 font-serif text-2xl font-semibold text-slate-900">Your ritual is now reserved</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">We have sent your request to the selected priest and confirmed the timing for your auspicious occasion.</p>
        <p className="mt-3 text-sm font-semibold text-maroon">Booking ID: {booking.id}</p>

        <div className="mt-6 rounded-[1.4rem] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-5 text-left shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryTile label="Ritual" value={puja?.title || 'Selected puja'} />
            <SummaryTile label="Amount" value={`₹${booking.amount}`} />
            <SummaryTile label="Date / Time" value={`${booking.date} • ${booking.timeslot}`} />
            <SummaryTile label="Pandit" value={pandit?.name || `ID ${booking.panditId}`} />
          </div>

          <div className="mt-4 rounded-2xl border border-amber-100 bg-white/90 p-3 text-sm text-slate-600 shadow-sm">
            <p><strong>Address:</strong> {address?.address || 'Not provided'}</p>
            <p className="mt-1"><strong>Contact:</strong> {address?.name} • {address?.phone}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link to="/dashboard" className="rounded-full bg-maroon px-5 py-2.5 font-semibold text-white shadow-sm transition hover:opacity-90">Go to My Bookings</Link>
          <Link to="/book" onClick={clearBookingDraft} className="rounded-full border border-amber-200 bg-white px-5 py-2.5 font-semibold text-slate-700">Book Another Puja</Link>
          <button onClick={() => window.print()} className="rounded-full border border-slate-200 bg-slate-50 px-5 py-2.5 font-semibold text-slate-700">Download Invoice</button>
        </div>
      </div>
    </BookingFrame>
  );
}
