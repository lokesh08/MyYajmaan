import { useLocation, Link } from 'react-router-dom';

import BookingStepper, { PACKAGE_STEPS } from '../components/BookingStepper';
import BookingFrame from '../components/BookingFrame';
import SummaryTile from '../components/SummaryTile';
import { clearBookingDraft } from '../utils/bookingFlowStorage';

export default function BookPackageConfirmation() {
  const { state } = useLocation();
  const booking = state?.booking;
  const puja = state?.puja;
  const address = state?.address;

  if (!booking) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-slate-600">No request found. Please complete a package puja request first.</p>
      </section>
    );
  }

  return (
    <BookingFrame
      title="Request Submitted"
      description="Our team will review your request and get in touch shortly."
      accentImage={puja?.image || undefined}
      asideTitle="Request summary"
      asideItems={[
        { label: `Request ID: ${booking.id}` },
        { label: `Package: ${puja?.title || 'Selected package'}` },
        { label: `Date: ${booking.date || booking.booking_date}` },
      ]}
    >
      <BookingStepper currentStep={5} steps={PACKAGE_STEPS} />
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600 shadow-sm">
          ✓
        </div>
        <h2 className="mt-4 font-serif text-2xl font-semibold text-slate-900">Your request has been submitted</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Our team will contact you shortly to understand your requirements and share a final quote. You'll see
          the quote and can complete payment right here once it's ready -- there's nothing to pay yet.
        </p>
        <p className="mt-3 text-sm font-semibold text-maroon">Request ID: {booking.id}</p>

        <div className="mt-6 rounded-[1.4rem] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-5 text-left shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryTile label="Package" value={puja?.title || 'Selected package'} />
            <SummaryTile label="Date / Time" value={`${booking.date || booking.booking_date} • ${booking.timeslot || booking.muhurat_time_slot}`} />
          </div>

          <div className="mt-4 rounded-2xl border border-amber-100 bg-white/90 p-3 text-sm text-slate-600 shadow-sm">
            <p><strong>Address:</strong> {address?.address || 'Not provided'}</p>
            <p className="mt-1"><strong>Contact:</strong> {address?.name} • {address?.phone}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link to="/dashboard/bookings?tab=package" title="Go to My Package Requests" className="inline-flex min-h-[44px] items-center interactive-button rounded-full bg-maroon px-5 py-2.5 font-semibold text-white shadow-sm hover:bg-maroon">
            Track My Request
          </Link>
          <Link to="/book" onClick={clearBookingDraft} title="Book another puja" className="inline-flex min-h-[44px] items-center interactive-button rounded-full border border-amber-200 bg-white px-5 py-2.5 font-semibold text-slate-700 hover:border-maroon hover:text-maroon">
            Book Another Puja
          </Link>
        </div>
      </div>
    </BookingFrame>
  );
}
