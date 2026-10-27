import { useEffect, useRef, useState } from "react";
import useLiveRefresh from "../../hooks/useLiveRefresh";
import { useSearchParams } from "react-router-dom";

import { Link } from "react-router-dom";

import {
  cancelMyBooking,
  getMyBookingCounts,
  getMyBookingInvoiceUrl,
  listMyClientBookings,
  rescheduleMyBooking,
  submitReview,
} from "../../services/clientApi";
import { cancelMyPackageBooking, listMyPackageBookings } from "../../services/packageBookingsApi";
import { showError, showSuccess } from "../../utils/toaster";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import Modal from "../../components/Modal";
import BookingDetailModal from "../../components/client/BookingDetailModal";

const PACKAGE_STATUS_STYLES = {
  pending_review: "bg-amber-50 text-amber-700",
  quoted: "bg-sky-50 text-sky-700",
  paid_pending_assignment: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-500",
};
const PACKAGE_STATUS_LABELS = {
  pending_review: "Pending Review",
  quoted: "Quoted — Pay Now",
  paid_pending_assignment: "Payment Received",
  cancelled: "Cancelled",
};

function PackageStatusPill({ status }) {
  // Once a Pandit Ji is assigned, a package booking's status becomes an
  // ordinary one (pending_pandit, confirmed, ...) -- from that point on
  // it reuses the exact same pill the Upcoming/Completed tabs show,
  // rather than a package-specific label that no longer applies.
  if (!PACKAGE_STATUS_LABELS[status]) {
    return <StatusPill status={status} />;
  }
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${PACKAGE_STATUS_STYLES[status] || "bg-amber-50 text-amber-700"}`}>
      {PACKAGE_STATUS_LABELS[status]}
    </span>
  );
}

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "package", label: "Package Requests" },
];

// Keeps Supabase Storage usage bounded -- a few feedback photos per
// review is the point, not an unlimited photo dump. The backend
// enforces this too (see reviews.py); this just gives a clearer
// in-the-moment message than waiting for the submit to fail.
const MAX_REVIEW_PHOTOS = 3;

const PAGE_SIZE = 10;
const RESCHEDULE_FEE = 500;
const CANCELLATION_FEE = 500;

// `declined` is deliberately styled and labeled identically to
// `pending_pandit` -- a Pandit Ji declining is an internal admin/pandit
// concern (they'll be reassigned), not something the customer should
// see as a distinct, alarming state. bookings.status genuinely still
// says "declined" under the hood; this is purely how it's rendered here.
function StatusPill({ status }) {
  const styles = {
    pending_pandit: "bg-amber-50 text-amber-700",
    confirmed: "bg-sky-50 text-sky-700",
    completed: "bg-emerald-50 text-emerald-700",
    cancelled: "bg-slate-100 text-slate-500",
    declined: "bg-amber-50 text-amber-700",
  };
  const labels = {
    pending_pandit: "Awaiting Confirmation",
    confirmed: "Confirmed",
    completed: "Completed",
    cancelled: "Cancelled",
    declined: "Awaiting Confirmation",
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status] || "bg-slate-100 text-slate-500"}`}>
      {labels[status] || status}
    </span>
  );
}

function formatTime12Hour(hhmm) {
  if (!hhmm) return "";
  const [hourStr, minute] = hhmm.split(":");
  let hour = parseInt(hourStr, 10);
  const period = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${String(hour).padStart(2, "0")}:${minute} ${period}`;
}

function RescheduleModal({ booking, open, onClose, onDone }) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDate("");
      setTime("");
    }
  }, [open]);

  async function handleSave() {
    if (!date || !time) {
      showError("Please choose a new date and time.");
      return;
    }
    setSaving(true);
    try {
      const result = await rescheduleMyBooking(booking.id, date, formatTime12Hour(time));
      showSuccess(result?.message || "Booking rescheduled successfully.");
      onDone();
      onClose();
    } catch (error) {
      showError(error?.message || "Could not reschedule this booking.");
    } finally {
      setSaving(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Modal open={open} onClose={onClose} title="Reschedule Booking" size="sm">
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Rescheduling costs Rs. {RESCHEDULE_FEE} (deducted from your wallet). Your Pandit Ji will need to reconfirm the new slot.
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">New Date</span>
          <input
            type="date"
            min={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">New Time</span>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
          />
        </label>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="interactive-button rounded-full border border-amber-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-amber-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="interactive-button rounded-full bg-maroon px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Confirm Reschedule"}
        </button>
      </div>
    </Modal>
  );
}

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

function FeedbackModal({ booking, open, onClose, onDone }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setRating(0);
      setComment("");
      setFiles([]);
    }
  }, [open]);

  async function handleSubmit() {
    if (!rating) {
      showError("Please select a rating.");
      return;
    }
    if (!comment.trim()) {
      showError("Please share a few words about your experience.");
      return;
    }
    setSubmitting(true);
    try {
      await submitReview({
        bookingId: booking.id,
        rating,
        comment: comment.trim(),
        pujaTitle: booking.notes || undefined,
        photos: files,
      });
      showSuccess("Thank you! Your feedback has been submitted.");
      onDone();
      onClose();
    } catch (error) {
      showError(error?.message || "Could not submit your feedback.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Leave Feedback" size="sm">
      <div className="space-y-4">
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Rating *</span>
          <StarPicker value={rating} onChange={setRating} />
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Your Feedback *</span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            placeholder="Share your experience with the Pandit Ji and the puja"
            className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Photos (optional, up to {MAX_REVIEW_PHOTOS})</span>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              const chosen = Array.from(e.target.files || []);
              if (chosen.length > MAX_REVIEW_PHOTOS) {
                showError(`Please choose at most ${MAX_REVIEW_PHOTOS} photos.`);
              }
              setFiles(chosen.slice(0, MAX_REVIEW_PHOTOS));
            }}
            className="w-full text-xs text-slate-500 file:mr-3 file:rounded-full file:border-0 file:bg-amber-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-maroon"
          />
          {files.length > 0 && <p className="mt-1 text-xs text-emerald-600">{files.length} photo(s) selected</p>}
        </label>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="interactive-button rounded-full border border-amber-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-amber-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="interactive-button rounded-full bg-maroon px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Submitting..." : "Submit Feedback"}
        </button>
      </div>
    </Modal>
  );
}

export default function ClientBookingsPage() {
  // Lets the dashboard's stat tiles deep-link straight to a tab
  // (e.g. /dashboard/bookings?tab=completed) instead of always
  // landing on "Upcoming".
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => {
    const requested = searchParams.get("tab");
    return TABS.some((t) => t.key === requested) ? requested : "upcoming";
  });
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ upcoming: 0, completed: 0, cancelled: 0 });
  const [loading, setLoading] = useState(true);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [feedbackTarget, setFeedbackTarget] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const silentRef = useRef(false);
  const [packageItems, setPackageItems] = useState([]);
  const [packageLoading, setPackageLoading] = useState(false);
  const [packageCancelTarget, setPackageCancelTarget] = useState(null);

  useEffect(() => setPage(1), [tab]);

  useEffect(() => {
    // "package" bookings have their own status lifecycle (pending_review
    // / quoted / paid_pending_assignment) that TAB_STATUSES on the
    // normal bookings endpoint doesn't know about -- fetched separately
    // below instead.
    if (tab === "package") return;
    // A live-notification reload keeps the current list on screen
    // instead of flashing the loading state.
    if (!silentRef.current) setLoading(true);
    listMyClientBookings({ tab, page, pageSize: PAGE_SIZE })
      .then((data) => {
        setItems(data?.items || []);
        setTotal(data?.total || 0);
      })
      .catch(() => {
        if (!silentRef.current) showError("Could not load your bookings.");
      })
      .finally(() => {
        setLoading(false);
        silentRef.current = false;
      });
  }, [tab, page, refreshKey]);

  useEffect(() => {
    if (tab !== "package") return;
    if (!silentRef.current) setPackageLoading(true);
    listMyPackageBookings()
      .then((data) => setPackageItems(data?.items || []))
      .catch(() => {
        if (!silentRef.current) showError("Could not load your package requests.");
      })
      .finally(() => {
        setPackageLoading(false);
        silentRef.current = false;
      });
  }, [tab, refreshKey]);

  async function handlePackageCancelConfirm() {
    if (!packageCancelTarget) return;
    setActionLoading(true);
    try {
      await cancelMyPackageBooking(packageCancelTarget.id);
      showSuccess("Your request has been cancelled.");
      setPackageCancelTarget(null);
      refresh();
    } catch (error) {
      showError(error?.data?.detail?.message || error?.message || "Could not cancel this request.");
    } finally {
      setActionLoading(false);
    }
  }

  useEffect(() => {
    getMyBookingCounts().then(setCounts).catch(() => {});
  }, [refreshKey]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function refresh() {
    setRefreshKey((k) => k + 1);
  }

  // A notification (e.g. Pandit Ji confirmed a booking) reloads the
  // list quietly so the status shown is always current.
  useLiveRefresh(() => {
    silentRef.current = true;
    refresh();
  });

  async function handleCancelConfirm() {
    if (!cancelTarget) return;
    setActionLoading(true);
    try {
      const result = await cancelMyBooking(cancelTarget.id, cancelReason);
      showSuccess(result?.message || "Booking cancelled.");
      setCancelTarget(null);
      setCancelReason("");
      refresh();
    } catch (error) {
      showError(error?.message || "Could not cancel this booking.");
    } finally {
      setActionLoading(false);
    }
  }

  const cancelPreview = cancelTarget
    ? cancelTarget.hours_until_event != null && cancelTarget.hours_until_event <= 6
      ? { fee: Number(cancelTarget.amount || 0), refund: 0, withinCutoff: true }
      : {
          fee: Math.min(CANCELLATION_FEE, Number(cancelTarget.amount || 0)),
          refund: Math.max(Number(cancelTarget.amount || 0) - CANCELLATION_FEE, 0),
          withinCutoff: false,
        }
    : null;

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-2xl font-semibold text-maroon">My Bookings</h1>

      <div className="flex flex-wrap gap-2 rounded-full border border-amber-100 bg-white p-1">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              tab === item.key ? "bg-maroon text-white" : "text-slate-600 hover:bg-amber-50"
            }`}
          >
            {item.label} ({item.key === "package" ? packageItems.length : (counts[item.key] ?? 0)})
          </button>
        ))}
      </div>

      {tab === "package" ? (
        packageLoading ? (
          <p className="py-10 text-center text-sm text-slate-400">Loading your package requests...</p>
        ) : packageItems.length === 0 ? (
          <div className="rounded-2xl border border-amber-100 bg-white p-8 text-center text-sm text-slate-400">
            No package puja requests yet.{" "}
            <Link to="/book" title="Browse package pujas" className="font-semibold text-maroon hover:underline">
              Browse package pujas →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {packageItems.map((booking) => (
              <div key={booking.id} className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-700">{booking.puja_title || "Package Puja"}</p>
                    <p className="text-xs text-slate-400">
                      {booking.booking_date} • {booking.muhurat_time_slot}
                    </p>
                  </div>
                  <PackageStatusPill status={booking.status} />
                </div>

                {booking.status === "quoted" && (
                  <p className="mt-2 text-sm text-slate-600">
                    Quoted amount: <span className="font-semibold text-maroon">Rs. {Number(booking.amount || 0).toFixed(2)}</span>
                  </p>
                )}
                {booking.cancelled_reason && (
                  <p className="mt-2 text-xs italic text-slate-400">"{booking.cancelled_reason}"</p>
                )}

                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  {booking.status === "quoted" && (
                    <Link
                      to={`/book/package/payment/${booking.id}`}
                      className="interactive-button rounded-full bg-maroon px-3 py-1.5 text-xs font-semibold text-white hover:bg-maroon"
                    >
                      Pay Now
                    </Link>
                  )}
                  {(booking.status === "pending_review" || booking.status === "quoted") && (
                    <button
                      type="button"
                      onClick={() => setPackageCancelTarget(booking)}
                      className="interactive-button rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                    >
                      Cancel Request
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading bookings...</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-amber-100 bg-white p-8 text-center text-sm text-slate-400">
          No {tab} bookings right now.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-amber-100 bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-amber-50/60 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Pandit Ji</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Timeslot</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-50">
              {items.map((booking) => (
                <tr key={booking.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-700">{booking.pandit_name || "Pandit Ji"}</p>
                    <p className="text-xs text-slate-400">{booking.pandit_city || ""}</p>
                  </td>
                  <td className="px-4 py-3">
                    {booking.booking_date || booking.date || "—"}
                    {booking.original_booking_date && (
                      <p className="text-xs italic text-slate-400">was {booking.original_booking_date}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">{booking.muhurat_time_slot || booking.timeslot || "—"}</td>
                  <td className="px-4 py-3">Rs. {Number(booking.amount || 0).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={booking.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setDetailTarget(booking)}
                        className="interactive-button rounded-full border border-amber-200 px-3 py-1.5 text-xs font-semibold text-maroon hover:bg-amber-50"
                      >
                        Details
                      </button>
                    </div>
                    {tab === "upcoming" && (
                      <div className="mt-2 flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          disabled={!booking.can_reschedule}
                          title={!booking.can_reschedule ? "Reschedule is disabled within 6 hours of your puja" : ""}
                          onClick={() => setRescheduleTarget(booking)}
                          className="interactive-button rounded-full border border-amber-200 px-3 py-1.5 text-xs font-semibold text-maroon hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Reschedule
                        </button>
                        <button
                          type="button"
                          disabled={!booking.can_cancel}
                          onClick={() => setCancelTarget(booking)}
                          className="interactive-button rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    {tab === "completed" && (
                      <div className="mt-2 flex flex-wrap justify-end gap-2">
                        {!booking.has_review && (
                          <button
                            type="button"
                            onClick={() => setFeedbackTarget(booking)}
                            className="interactive-button rounded-full bg-maroon px-3 py-1.5 text-xs font-semibold text-white hover:bg-maroon"
                          >
                            Leave Feedback
                          </button>
                        )}
                        {booking.has_review && <span className="self-center text-xs text-emerald-600">Feedback submitted ✓</span>}
                        <a
                          href={getMyBookingInvoiceUrl(booking.id)}
                          target="_blank"
                          rel="noreferrer"
                          title="Download tax invoice"
                          className="interactive-button rounded-full border border-amber-200 px-3 py-1.5 text-xs font-semibold text-maroon hover:bg-amber-50"
                        >
                          Download Invoice
                        </a>
                      </div>
                    )}
                    {tab === "cancelled" && (
                      <div className="mt-2 text-right text-xs text-slate-500">
                        {Number(booking.refund_amount || 0) > 0 ? (
                          <span className="text-emerald-600">Refunded Rs. {Number(booking.refund_amount).toFixed(2)}</span>
                        ) : (
                          <span className="text-rose-500">No refund</span>
                        )}
                        {booking.cancelled_reason && <p className="italic">"{booking.cancelled_reason}"</p>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
          <span>
            Showing {items.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="interactive-button rounded-lg border border-amber-200 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-2 py-1.5">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              className="interactive-button rounded-lg border border-amber-200 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <RescheduleModal
        booking={rescheduleTarget}
        open={Boolean(rescheduleTarget)}
        onClose={() => setRescheduleTarget(null)}
        onDone={refresh}
      />

      <FeedbackModal
        booking={feedbackTarget}
        open={Boolean(feedbackTarget)}
        onClose={() => setFeedbackTarget(null)}
        onDone={refresh}
      />

      <BookingDetailModal
        booking={detailTarget}
        open={Boolean(detailTarget)}
        onClose={() => setDetailTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancel Booking"
        message={
          cancelPreview
            ? cancelPreview.withinCutoff
              ? "This booking is within 6 hours of the scheduled puja — the full amount will be forfeited, no refund applies."
              : `Rs. ${cancelPreview.fee.toFixed(2)} cancellation fee applies. Rs. ${cancelPreview.refund.toFixed(2)} will be refunded to your wallet.`
            : ""
        }
        confirmLabel="Cancel Booking"
        confirmClassName="bg-rose-600 hover:bg-rose-700"
        loading={actionLoading}
        onConfirm={handleCancelConfirm}
        onClose={() => {
          setCancelTarget(null);
          setCancelReason("");
        }}
      >
        <textarea
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          rows={2}
          placeholder="Reason for cancellation (optional)"
          className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
        />
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(packageCancelTarget)}
        title="Cancel this request?"
        message="No payment has been made yet, so there's nothing to refund -- this just withdraws your request."
        confirmLabel="Cancel Request"
        confirmClassName="bg-rose-600 hover:bg-rose-700"
        loading={actionLoading}
        onConfirm={handlePackageCancelConfirm}
        onClose={() => setPackageCancelTarget(null)}
      />
    </div>
  );
}
