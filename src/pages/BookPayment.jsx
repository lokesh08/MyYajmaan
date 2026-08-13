import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import BookingStepper from '../components/BookingStepper';
import BookingFrame from '../components/BookingFrame';
import SelectionCard from '../components/SelectionCard';
import ThemeDialog from '../components/ThemeDialog';
import { initiatePayment, verifyPayment } from '../services/payments';
import { createBooking } from '../services/bookings';
import { getBookingDraft, saveBookingDraft } from '../utils/bookingFlowStorage';

export default function BookPayment() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [method, setMethod] = useState('upi');
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState({ open: false, title: '', message: '' });
  const draft = getBookingDraft();
  const preserved = state?.date ? state : draft;

  const { date, slot, puja, pandit, address } = preserved || {};

  const controllerRef = useRef(null);

  // Cleanup: abort any inflight payment/booking requests if component unmounts
  useEffect(() => {
    return () => {
      if (controllerRef.current) {
        try { controllerRef.current.abort(); } catch (e) { /* ignore */ }
        controllerRef.current = null;
      }
    };
  }, []);

  if (!date || !slot || !pandit) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-slate-600">Incomplete booking data. Go back and complete earlier steps.</p>
      </section>
    );
  }

  const amount = pandit.price;

  async function handlePay() {
    // If already processing, ignore duplicate clicks
    if (loading) return;

    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    try {
      // 1) initiate payment (pass signal for cancellation)
      // Expectation: initiatePayment returns at least { sessionId } and optionally { redirectUrl }
      const session = await initiatePayment({ amount, method }, { signal: controller.signal });

      // If caller cancelled during initiatePayment
      if (controller.signal.aborted) return;

      // Case A: provider requires redirect (popup)
      if (session && session.redirectUrl) {
        // Open popup for provider flow
        const popup = window.open(session.redirectUrl, 'payment_window', 'width=600,height=800');

        if (!popup) {
          // Popup blocked — show error
          setDialog({
            open: true,
            title: 'Popup blocked',
            message: 'Please allow popups or use a different browser to complete payment.',
          });
          return;
        }

        // Poll verify endpoint until success, failure, popup closed, cancellation, or timeout
        const pollIntervalMs = 2000; // poll every 2s
        const maxPollAttempts = 60; // ~2 minutes
        let attempts = 0;
        let verified = null;

        while (!controller.signal.aborted && attempts < maxPollAttempts) {
          // If popup closed by user, give up and show dialog
          if (popup.closed) {
            setDialog({
              open: true,
              title: 'Payment interrupted',
              message: 'The payment window was closed before completion. Please try again.',
            });
            break;
          }

          try {
            // Wait between polls (skip wait on first attempt)
            if (attempts > 0) {
              // small delay
              await new Promise((res) => setTimeout(res, pollIntervalMs));
            }

            // call verifyPayment with signal to allow cancellation
            const verification = await verifyPayment(session.sessionId, { signal: controller.signal });

            if (controller.signal.aborted) return;

            // If verifyPayment returns status field, check it
            if (verification && verification.status) {
              if (verification.status === 'success') {
                verified = verification;
                break;
              }
              // Optionally handle explicit failure status by breaking
              if (verification.status === 'failed' || verification.status === 'error') {
                setDialog({
                  open: true,
                  title: 'Payment failed',
                  message: 'The payment did not complete successfully. Please try again.',
                });
                break;
              }
            }
          } catch (err) {
            // If canceled, rethrow to let outer catch handle it
            if (err?.name === 'CanceledError' || err?.isCanceled) {
              throw err;
            }
            // Non-fatal verify error — log and continue polling (transient)
            console.warn('verifyPayment polling error (will retry)', err);
          }

          attempts += 1;
        }

        // Close popup if still open
        try { if (popup && !popup.closed) popup.close(); } catch (e) { /* ignore */ }

        if (verified && verified.status === 'success') {
          // create booking and navigate
          const booking = await createBooking(
            {
              pujaId: puja?.id || 1,
              panditId: pandit.id,
              date,
              timeslot: slot.time,
              amount,
              paymentRef: verified.sessionId || session.sessionId,
            },
            { signal: controller.signal }
          );

          // If abort happened during createBooking, return quietly
          if (controller.signal.aborted) return;

          saveBookingDraft({ date, slot, puja, pandit, address, booking });
          controllerRef.current = null;
          navigate('/book/confirmation', { state: { booking, address, puja, pandit } });
          return;
        }

        // If we exit loop without verified success and no dialog shown, show generic failure
        if (!verified && !controller.signal.aborted) {
          if (!popup || popup.closed) {
            // already showed popup-closed dialog above
          } else {
            setDialog({
              open: true,
              title: 'Payment timeout',
              message: 'Payment was not confirmed in time. Please check your bank or try again.',
            });
          }
        }

        return;
      }

      // Case B: immediate flow — verify directly (previous behavior)
      const verification = await verifyPayment(session.sessionId, { signal: controller.signal });

      if (controller.signal.aborted) return;

      if (verification.status === 'success') {
        const booking = await createBooking(
          {
            pujaId: puja?.id || 1,
            panditId: pandit.id,
            date,
            timeslot: slot.time,
            amount,
            paymentRef: verification.sessionId,
          },
          { signal: controller.signal }
        );

        if (controller.signal.aborted) return;

        saveBookingDraft({ date, slot, puja, pandit, address, booking });
        controllerRef.current = null;
        navigate('/book/confirmation', { state: { booking, address, puja, pandit } });
        return;
      } else {
        setDialog({
          open: true,
          title: 'Payment failed',
          message: 'The payment did not complete successfully. Please try again.',
        });
      }
    } catch (err) {
      // If cancelled, silently return (component unmount or user cancelled)
      if (err?.name === 'CanceledError' || err?.isCanceled) {
        return;
      }

      console.error('Payment flow error', err);
      setDialog({
        open: true,
        title: 'Payment error',
        message: 'Something went wrong while processing your payment. Please try again.',
      });
    } finally {
      setLoading(false);
      // Clear controller unless navigation already happened
      controllerRef.current = null;
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
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {[
              { key: 'upi', label: 'UPI' },
              { key: 'card', label: 'Card' },
              { key: 'wallet', label: 'Wallet' },
            ].map((option) => (
              <SelectionCard
                key={option.key}
                ariaLabel={`Select ${option.label} payment`}
                ariaPressed={method === option.key}
                selected={method === option.key}
                onClick={() => setMethod(option.key)}
                className="px-3 py-3"
              >
                <p className="text-sm font-semibold text-slate-700">{option.label}</p>
              </SelectionCard>
            ))}
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={handlePay}
            disabled={loading}
            className="rounded-full bg-saffron px-5 py-2 font-semibold text-white shadow-sm transition hover:opacity-90"
          >
            {loading ? 'Processing…' : `Pay ₹${amount}`}
          </button>
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