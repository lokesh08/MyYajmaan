import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import BookingStepper, { PACKAGE_STEPS } from '../components/BookingStepper';
import BookingFrame from '../components/BookingFrame';
import ThemeNotice from '../components/ThemeNotice';
import { getBookingDraft, saveBookingDraft } from '../utils/bookingFlowStorage';
import { missingStepPath, resolveBookingData, stepNumber } from '../utils/bookingSteps';
import { createPackageBooking } from '../services/packageBookingsApi';
import { showError } from '../utils/toaster';

export default function BookPackageDetails() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const draft = getBookingDraft();
  const preserved = resolveBookingData(state, draft);

  const { date, slot, puja, address } = preserved;
  const [eventDetails, setEventDetails] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const missingPath = missingStepPath('packageDetails', preserved);
  if (missingPath) {
    return <Navigate to={missingPath} replace state={puja ? { puja } : undefined} />;
  }

  async function handleSubmit() {
    if (eventDetails.trim().length < 10) {
      setNotice('Please describe your requirements in at least a few words so our team can prepare properly.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await createPackageBooking({
        catalogPujaId: puja.id,
        date,
        timeslot: slot.time,
        contactName: address.name,
        contactPhone: address.phone,
        addressLine: address.address,
        addressCity: address.city,
        addressState: address.state,
        addressPincode: address.pin,
        eventDetails: eventDetails.trim(),
      });
      saveBookingDraft({ date, slot, puja, address, packageBooking: result?.booking });
      navigate('/book/package/confirmation', { state: { booking: result?.booking, puja, address } });
    } catch (error) {
      showError(error?.data?.detail?.message || error?.message || 'Could not submit your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BookingFrame
      title="Tell us about your requirements"
      description="No payment needed yet -- our team will review this and call you before sharing a final quote."
      accentImage={puja?.image || undefined}
      asideTitle="Request summary"
      asideItems={[
        { label: `Package: ${puja?.title || 'Selected package'}` },
        { label: `Date: ${date}` },
        { label: `Time: ${slot?.time || ''}` },
        { label: `Address: ${address?.city || ''}` },
      ]}
    >
      <BookingStepper currentStep={stepNumber('packageDetails', puja)} steps={PACKAGE_STEPS} />

      <div className="mt-6">
        <label className="block text-sm font-medium text-slate-700" htmlFor="event-details">
          What do you need for this puja?
        </label>
        <textarea
          id="event-details"
          value={eventDetails}
          onChange={(event) => {
            setEventDetails(event.target.value);
            setNotice('');
          }}
          rows={6}
          placeholder="E.g. number of guests, specific rituals to include, any preferences for the Pandit Ji, timing flexibility, etc."
          className="mt-2 min-h-32 w-full rounded-[1.1rem] border border-amber-100 bg-gradient-to-r from-amber-50/70 to-white px-3 py-2 shadow-sm transition focus:border-maroon focus:outline-none"
        />

        {notice && <ThemeNotice type="error" title="Almost there" message={notice} />}

        <div className="mt-6 flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="min-h-[44px] interactive-button rounded-full bg-saffron px-5 py-2 font-semibold text-white shadow-sm transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
          <button onClick={() => navigate(-1)} className="min-h-[44px] interactive-button rounded-full border border-amber-200 bg-white px-5 py-2 text-slate-700 hover:border-maroon hover:text-maroon">
            Back
          </button>
        </div>
      </div>
    </BookingFrame>
  );
}
