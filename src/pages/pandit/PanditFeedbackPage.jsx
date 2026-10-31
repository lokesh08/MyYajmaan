import { useEffect, useState } from "react";

import { usePanditPortal } from "../../context/PanditPortalContext";
import { listMyBookings, listMyFeedback, submitFeedback } from "../../services/panditApi";
import { showError, showSuccess } from "../../utils/toaster";
import LockedNotice from "../../components/pandit/LockedNotice";
import { t } from "../../i18n";

function StarPicker({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`text-2xl transition ${star <= value ? "text-amber-400" : "text-slate-200"}`}
          aria-label={`${star} star`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function PanditFeedbackPage() {
  const { stage, rejectionReason } = usePanditPortal();
  const [bookings, setBookings] = useState([]);
  const [bookingId, setBookingId] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  function loadHistory() {
    setLoadingHistory(true);
    listMyFeedback({ page: 1, pageSize: 20 })
      .then((data) => setHistory(data?.items || []))
      .catch(() => showError(t("Could not load your feedback history.")))
      .finally(() => setLoadingHistory(false));
  }

  useEffect(() => {
    if (stage !== "approved") return;
    listMyBookings({ tab: "completed", page: 1, pageSize: 50 })
      .then((data) => setBookings(data?.items || []))
      .catch(() => {});
    loadHistory();
  }, [stage]);

  if (stage !== "approved") {
    return <LockedNotice stage={stage} rejectionReason={rejectionReason} />;
  }

  async function handleSubmit() {
    if (!comment.trim()) {
      showError(t("Please enter your feedback."));
      return;
    }
    setSubmitting(true);
    try {
      await submitFeedback({ booking_id: bookingId || undefined, rating: rating || undefined, comment: comment.trim() });
      showSuccess(t("Feedback submitted successfully. Thank you!"));
      setBookingId("");
      setRating(0);
      setComment("");
      loadHistory();
    } catch (error) {
      showError(error?.message || t("Could not submit your feedback."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-2xl font-semibold text-maroon">{t("Feedback for Admin")}</h1>

      <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
        <label className="block max-w-md">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">{t("Related Booking (optional)")}</span>
          <select
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value)}
            className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
          >
            <option value="">{t("General feedback")}</option>
            {bookings.map((booking) => (
              <option key={booking.id} value={booking.id}>
                {booking.customer_name || t("Customer")} — {booking.booking_date || booking.date}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-4">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">{t("Rating (optional)")}</span>
          <StarPicker value={rating} onChange={setRating} />
        </div>

        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">{t("Your Feedback *")}</span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            placeholder={t("Share your experience, concerns, or suggestions with the admin team")}
            className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
          />
        </label>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="interactive-button mt-4 rounded-full bg-maroon px-6 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? t("Submitting...") : t("Submit Feedback")}
        </button>
      </div>

      <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-serif text-lg font-semibold text-maroon">{t("Your Feedback History")}</h2>
        {loadingHistory ? (
          <p className="py-6 text-center text-sm text-slate-400">{t("Loading...")}</p>
        ) : history.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">{t("You haven't submitted any feedback yet.")}</p>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <div key={item.id} className="rounded-xl border border-amber-100 bg-cream/40 p-3">
                <div className="flex items-center justify-between">
                  {item.rating ? (
                    <span className="text-sm text-amber-400">{"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)}</span>
                  ) : (
                    <span className="text-xs text-slate-400">{t("No rating")}</span>
                  )}
                  <span className="text-xs text-slate-400">{new Date(item.created_at).toLocaleDateString()}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{item.comment}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
