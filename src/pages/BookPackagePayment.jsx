import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { payWithRazorpay } from '../services/razorpay';
import { confirmPackageBookingPayment, listMyPackageBookings } from '../services/packageBookingsApi';
import { showError, showSuccess } from '../utils/toaster';
import ThemeDialog from '../components/ThemeDialog';
import { t } from "../i18n";

export default function BookPackagePayment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [dialog, setDialog] = useState({ open: false, title: '', message: '' });

  useEffect(() => {
    listMyPackageBookings()
      .then((data) => {
        const found = (data?.items || []).find((item) => item.id === id);
        setBooking(found || null);
      })
      .catch(() => setBooking(null))
      .finally(() => setLoading(false));
  }, [id]);

  async function handlePay() {
    if (!booking || paying) return;
    setPaying(true);
    let paymentRef = null;
    try {
      const verification = await payWithRazorpay({
        amount: Number(booking.amount),
        description: booking.puja_title || 'Package puja',
        prefill: {
          name: profile?.full_name || undefined,
          email: profile?.email || undefined,
          contact: profile?.phone || undefined,
        },
      });
      paymentRef = verification.sessionId;
      await confirmPackageBookingPayment(booking.id, paymentRef);
      showSuccess(t("Payment received. Our team will now assign a Pandit Ji."));
      navigate('/dashboard/bookings?tab=package');
    } catch (error) {
      if (error?.isPaymentCancelled) {
        setDialog({ open: true, title: t("Payment cancelled"), message: t("You closed the payment window before completing the payment. No money was charged.") });
      } else if (paymentRef) {
        setDialog({
          open: true,
          title: t("Payment received"),
          message: t("Your payment (ref: {paymentRef}) was received, but we could not update your request. Please do not pay again - contact support with this reference.", { paymentRef: paymentRef }),
        });
      } else {
        showError(error?.data?.detail?.message || error?.message || t("Something went wrong while processing your payment."));
      }
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-slate-600">{t("Loading...")}</p>
      </section>
    );
  }

  if (!booking) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-slate-600">{t("This request could not be found.")}</p>
      </section>
    );
  }

  if (booking.status !== 'quoted') {
    return (
      <section className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-slate-600">{t("This request isn't awaiting payment right now.")}</p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="rounded-[1.5rem] border border-amber-100 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-saffron">{t("Package Puja Payment")}</p>
        <h1 className="mt-2 font-serif text-2xl font-semibold text-maroon">{booking.puja_title || t("Your package puja")}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {booking.booking_date} • {booking.muhurat_time_slot}
        </p>

        <div className="mt-6 rounded-[1.25rem] border border-amber-100 bg-amber-50/50 p-4">
          <div className="flex items-center justify-between border-t border-amber-100 pt-2 text-base font-bold text-maroon">
            <span>{t("Quoted Amount")}</span>
            <span>{t("Rs.")}{' '}{Number(booking.amount || 0).toFixed(2)}</span>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={handlePay}
            disabled={paying}
            className="min-h-[44px] interactive-button rounded-full bg-saffron px-5 py-2 font-semibold text-white shadow-sm transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {paying ? t("Processing…") : t("Pay Rs. {v0}", { v0: Number(booking.amount || 0).toFixed(2) })}
          </button>
          <button onClick={() => navigate(-1)} className="min-h-[44px] interactive-button rounded-full border border-amber-200 bg-white px-5 py-2 text-slate-700 hover:border-maroon hover:text-maroon">
            {t("Back")}
          </button>
        </div>
      </div>

      <ThemeDialog
        open={dialog.open}
        title={dialog.title}
        message={dialog.message}
        onClose={() => setDialog((prev) => ({ ...prev, open: false }))}
      />
    </section>
  );
}
