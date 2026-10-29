import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { get } from '../api';
import { useAuth } from '../context/AuthContext';
import BookingStepper from '../components/BookingStepper';
import BookingFrame from '../components/BookingFrame';
import CouponsShowcase from '../components/CouponsShowcase';
import ThemeDialog from '../components/ThemeDialog';
import { payWithRazorpay } from '../services/razorpay';
import { createBooking } from '../services/bookings';
import { validateCoupon } from '../services/coupons';
import { getBookingDraft, saveBookingDraft } from '../utils/bookingFlowStorage';

const PAYMENT_METHOD = 'razorpay';
const DEFAULT_PRICING = { premium_package_fee: 500, gst_percentage: 0, platform_fee: 200 };

export default function BookPayment() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState({ open: false, title: '', message: '' });
    const [couponCode, setCouponCode] = useState('');
    const [coupon, setCoupon] = useState(null);
    const [couponMessage, setCouponMessage] = useState('');
    const [couponLoading, setCouponLoading] = useState(false);
  const [pricing, setPricing] = useState(DEFAULT_PRICING);
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

  // Admin-configured pricing add-ons (Admin Settings -> Pricing). Fails
  // open to the documented defaults rather than blocking payment.
  useEffect(() => {
    let mounted = true;
    get('/settings/pricing')
      .then((data) => {
        if (mounted && data) setPricing({ ...DEFAULT_PRICING, ...data });
      })
      .catch(() => {
        /* keep the defaults */
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!date || !slot || !pandit || !address) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-slate-600">Incomplete booking data. Go back and complete earlier steps.</p>
      </section>
    );
  }

  // Real per-puja price the selected Pandit Ji charges for this puja
  // (pandit_puja.price_override, or the puja's own base_price) -- see
  // routers/pandits.py's GET /pandits?puja_id=... this is always the
  // correct value whenever a pandit is returned at all, no fallback
  // needed.
  const panditPrice = Number(pandit.price) || 0;
  const isPremium = puja?.tier === 'premium';
  const premiumFee = isPremium ? Number(pricing.premium_package_fee) || 0 : 0;
  const subtotal = panditPrice + premiumFee;
  const discount = coupon?.discount || 0;
  const discountedSubtotal = Math.max(0, subtotal - discount);
  const gstPercent = Number(pricing.gst_percentage) || 0;
  const platformFee = Number(pricing.platform_fee) || 0;
  // GST applies only to MyYajmaan's own platform fee, never to the
  // Pandit Ji's service -- that's treated as out of scope for this tax
  // line entirely, not just discounted. See invoicing.py for how this
  // same split carries through to the actual tax invoice.
  const gstAmount = Math.round((platformFee * gstPercent) / 100 * 100) / 100;
  const payableAmount = Math.round((discountedSubtotal + gstAmount + platformFee) * 100) / 100;

    async function handleApplyCoupon(explicitCode) {
      const code = (explicitCode ?? couponCode).trim();
      if (!code || couponLoading) return;

      setCouponLoading(true);
      setCoupon(null);
      setCouponMessage('');

      try {
        const result = await validateCoupon({
          code,
          amount: subtotal,
          pujaId: puja?.id,
        });

        if (result.valid) {
          setCoupon(result);
          setCouponMessage(`Coupon applied. You save ₹${result.discount}.`);
        } else {
          setCouponMessage(result.message || 'Enter a valid coupon code.');
        }
      } catch {
        setCouponMessage('We could not validate that coupon. Please try again.');
      } finally {
        setCouponLoading(false);
      }
    }

    function selectCouponCode(code) {
      setCouponCode(code);
      setCoupon(null);
      setCouponMessage('');
      handleApplyCoupon(code);
    }

  async function handlePay() {
    // If already processing, ignore duplicate clicks
    if (loading) return;

    const controller = new AbortController();
    controllerRef.current = controller;

    let paymentRef = null;

    setLoading(true);
    try {
      // Razorpay is the only payment method: the order is created and
      // the signature verified server-side (routers/payments.py); this
      // resolves only once the payment is genuinely verified.
      const verification = await payWithRazorpay({
        amount: payableAmount,
        description: puja?.title ? `${puja.title} with ${pandit.name}` : 'Puja booking',
        prefill: {
          name: profile?.full_name || undefined,
          email: profile?.email || undefined,
          contact: profile?.phone || undefined,
        },
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;
      paymentRef = verification.sessionId;

      const booking = await createBooking(
        {
          pujaId: puja?.id,
          pujaTitle: puja?.title,
          panditId: pandit.id,
          date,
          timeslot: slot.time,
          amount: payableAmount,
          paymentRef: verification.sessionId,
          couponId: coupon?.id,
          couponDiscount: discount,
          address,
          paymentMethod: PAYMENT_METHOD,
          packageTier: puja?.tier,
          premiumFee,
          gstAmount,
          platformFee,
          panditFeeAmount: panditPrice,
        },
        { signal: controller.signal }
      );

      // If abort happened during createBooking, return quietly
      if (controller.signal.aborted) return;

      saveBookingDraft({ date, slot, puja, pandit, address, booking });
      controllerRef.current = null;
      navigate('/book/confirmation', { state: { booking, address, puja, pandit } });
    } catch (err) {
      // Component unmounted / request cancelled: nothing to show.
      if (err?.name === 'CanceledError' || err?.isCanceled) {
        return;
      }

      // Customer closed the Razorpay window without paying.
      if (err?.isPaymentCancelled) {
        setDialog({
          open: true,
          title: 'Payment cancelled',
          message: 'You closed the payment window before completing the payment. No money was charged.',
        });
        return;
      }

      console.error('Payment flow error', err);

      // Money already left the customer's account but the booking could
      // not be saved -- say so plainly (with the reference) rather than
      // a generic "try again", which could lead to paying twice.
      if (paymentRef) {
        setDialog({
          open: true,
          title: 'Payment received',
          message: `Your payment (ref: ${paymentRef}) was received, but we could not complete your booking${err?.message ? ` (${err.message})` : ''}. Please do not pay again - contact support with this reference and we will sort it out.`,
        });
        return;
      }

      setDialog({
        open: true,
        title: 'Payment error',
        message: err?.message || 'Something went wrong while processing your payment. Please try again.',
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
      description="Review your booking and pay securely."
      accentImage={puja?.image || undefined}
      asideTitle="Booking review"
      asideItems={[
        { label: `Ritual: ${puja?.title || 'Selected puja'}` },
        { label: `Pandit: ${pandit.name}` },
        { label: `Total: ₹${payableAmount.toFixed(2)}` },
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
            {isPremium && (
              <span className="mb-1 inline-block rounded-full bg-gradient-to-r from-saffron to-gold px-2.5 py-0.5 text-xs font-bold text-white">
                PREMIUM
              </span>
            )}
            <p className="font-semibold text-maroon">₹{panditPrice.toFixed(2)}</p>
            <p className="text-xs text-slate-400">Puja price</p>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="block text-sm font-medium text-slate-700" htmlFor="coupon-code">Coupon code</label>
            <CouponsShowcase variant="link" onSelectCode={selectCouponCode} />
          </div>
          <div className="mt-2 flex gap-2">
            <input
              id="coupon-code"
              value={couponCode}
              onChange={(event) => {
                setCouponCode(event.target.value.toUpperCase());
                setCoupon(null);
                setCouponMessage('');
              }}
              placeholder="Enter coupon code"
              className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-amber-200 px-3 py-2 text-sm uppercase outline-none focus:border-maroon"
            />
            <button
              type="button"
              onClick={handleApplyCoupon}
              disabled={!couponCode.trim() || couponLoading}
              className="interactive-button min-h-[44px] rounded-xl border border-amber-200 px-4 py-2 text-sm font-semibold text-maroon disabled:cursor-not-allowed disabled:opacity-60"
            >
              {couponLoading ? 'Checking...' : 'Apply'}
            </button>
          </div>
          {couponMessage && (
            <p className={`mt-2 text-sm ${coupon ? 'text-emerald-700' : 'text-rose-600'}`}>
              {couponMessage}
            </p>
          )}
          {coupon && (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <span>Coupon discount</span>
              <span>-₹{coupon.discount}</span>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between rounded-[1.25rem] border border-amber-100 bg-white p-4 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-slate-700">Payment</p>
            <p className="text-xs text-slate-500">Pay securely with UPI, cards, net banking or wallets via Razorpay.</p>
          </div>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-maroon">Razorpay</span>
        </div>

        <div className="mt-4 rounded-[1.25rem] border border-amber-100 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">Price Breakdown</p>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Puja price</span>
              <span className="font-medium text-slate-800">₹{panditPrice.toFixed(2)}</span>
            </div>
            {isPremium && (
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Premium package fee</span>
                <span className="font-medium text-slate-800">₹{premiumFee.toFixed(2)}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex items-center justify-between text-emerald-700">
                <span>Coupon discount</span>
                <span>-₹{discount.toFixed(2)}</span>
              </div>
            )}
            {gstAmount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-slate-600">GST ({gstPercent}%) on platform fee</span>
                <span className="font-medium text-slate-800">₹{gstAmount.toFixed(2)}</span>
              </div>
            )}
            {platformFee > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Platform fee</span>
                <span className="font-medium text-slate-800">₹{platformFee.toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-amber-100 pt-2 text-base font-bold text-maroon">
              <span>Total</span>
              <span>₹{payableAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={handlePay}
            disabled={loading}
            className="min-h-[44px] interactive-button rounded-full bg-saffron px-5 py-2 font-semibold text-white shadow-sm transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Processing…' : `Pay ₹${payableAmount.toFixed(2)}`}
          </button>
          <button onClick={() => navigate(-1)} className="min-h-[44px] interactive-button rounded-full border border-amber-200 bg-white px-5 py-2 text-slate-700 hover:border-maroon hover:text-maroon">Back</button>
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