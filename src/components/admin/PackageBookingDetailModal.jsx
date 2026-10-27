import { useEffect, useState } from "react";

import Modal from "../Modal";
import ConfirmDialog from "./ConfirmDialog";
import {
  assignPanditToPackageBooking,
  cancelPackageBookingAdmin,
  getPackageBookingDetail,
  listPandits,
  quotePackageBooking,
} from "../../services/adminApi";
import { showError, showSuccess } from "../../utils/toaster";

const STATUS_STYLES = {
  pending_review: "bg-amber-100 text-amber-700",
  quoted: "bg-sky-100 text-sky-700",
  paid_pending_assignment: "bg-emerald-100 text-emerald-700",
};
const STATUS_LABELS = {
  pending_review: "Pending Review",
  quoted: "Quoted",
  paid_pending_assignment: "Awaiting Pandit Assignment",
};

export default function PackageBookingDetailModal({ bookingId, open, onClose, onChanged }) {
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(false);

  const [quoteAmount, setQuoteAmount] = useState("");
  const [quoteNote, setQuoteNote] = useState("");
  const [quoting, setQuoting] = useState(false);

  const [pandits, setPandits] = useState([]);
  const [selectedPanditId, setSelectedPanditId] = useState("");
  const [assigning, setAssigning] = useState(false);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  function load() {
    if (!bookingId) return;
    setLoading(true);
    getPackageBookingDetail(bookingId)
      .then((data) => setBooking(data?.booking || null))
      .catch(() => setBooking(null))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!open || !bookingId) return;
    setQuoteAmount("");
    setQuoteNote("");
    setSelectedPanditId("");
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bookingId]);

  useEffect(() => {
    if (!open || booking?.status !== "paid_pending_assignment") return;
    listPandits({ status: "approved", pageSize: 100 })
      // Only Pandit Ji's with a linked portal account can log in to
      // accept/decline a booking -- a catalog-only listing (no account
      // yet) would leave the request stuck with nobody able to respond.
      .then((data) => setPandits((data?.items || []).filter((p) => p.is_active && p.user_id)))
      .catch(() => setPandits([]));
  }, [open, booking?.status]);

  async function handleQuote() {
    const amount = Number(quoteAmount);
    if (!amount || amount <= 0) {
      showError("Enter a valid quote amount.");
      return;
    }
    setQuoting(true);
    try {
      await quotePackageBooking(bookingId, amount, quoteNote.trim());
      showSuccess("Quote sent to the Yajmaan.");
      load();
      onChanged?.();
    } catch (error) {
      showError(error?.data?.detail?.message || error?.message || "Could not save this quote.");
    } finally {
      setQuoting(false);
    }
  }

  async function handleAssign() {
    if (!selectedPanditId) {
      showError("Select a Pandit Ji to assign.");
      return;
    }
    setAssigning(true);
    try {
      await assignPanditToPackageBooking(bookingId, selectedPanditId);
      showSuccess("Pandit Ji assigned. They've been notified to accept or decline.");
      load();
      onChanged?.();
    } catch (error) {
      showError(error?.data?.detail?.message || error?.message || "Could not assign this Pandit Ji.");
    } finally {
      setAssigning(false);
    }
  }

  async function handleCancel() {
    if (!cancelReason.trim()) {
      showError("A reason is required to cancel this request.");
      return;
    }
    setCancelling(true);
    try {
      await cancelPackageBookingAdmin(bookingId, cancelReason.trim());
      showSuccess("Request cancelled.");
      setCancelOpen(false);
      setCancelReason("");
      load();
      onChanged?.();
    } catch (error) {
      showError(error?.data?.detail?.message || error?.message || "Could not cancel this request.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Package Puja Request" size="lg">
      {loading && <p className="py-10 text-center text-sm text-slate-400">Loading...</p>}
      {!loading && !booking && <p className="py-10 text-center text-sm text-slate-400">This request could not be loaded.</p>}

      {!loading && booking && (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-serif text-lg font-semibold text-maroon">{booking.puja?.title}</p>
              <p className="text-xs text-slate-500">Requested {new Date(booking.created_at).toLocaleString()}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[booking.status] || "bg-slate-100 text-slate-600"}`}>
              {STATUS_LABELS[booking.status] || booking.status}
            </span>
          </div>

          <div className="grid gap-3 rounded-xl border border-amber-100 bg-amber-50/50 p-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-400">Yajmaan</p>
              <p className="font-medium text-slate-700">{booking.customer?.full_name}</p>
              <p className="text-xs text-slate-500">{booking.customer?.email} · {booking.customer?.phone}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Requested Date</p>
              <p className="font-medium text-slate-700">{booking.booking_date} {booking.muhurat_time_slot}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-slate-400">Address</p>
              <p className="font-medium text-slate-700">
                {[booking.address_line, booking.address_city, booking.address_state, booking.address_pincode].filter(Boolean).join(", ")}
              </p>
              <p className="text-xs text-slate-500">Contact: {booking.contact_name} · {booking.contact_phone}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-slate-400">What the Yajmaan needs</p>
              <p className="whitespace-pre-wrap text-slate-700">{booking.event_details || "Not provided."}</p>
            </div>
          </div>

          {booking.quoted_price != null && (
            <div className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-sky-800">
              Quoted Rs. {Number(booking.quoted_price).toFixed(2)} by {booking.quoted_by_name || "an admin"} on{" "}
              {booking.quoted_at ? new Date(booking.quoted_at).toLocaleString() : "-"}.
            </div>
          )}

          {booking.assignment_history?.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Assignment History</p>
              <ul className="space-y-1 rounded-xl border border-amber-100 bg-white p-3 text-xs text-slate-600">
                {booking.assignment_history.map((event) => (
                  <li key={event.id}>
                    {new Date(event.created_at).toLocaleString()} — {event.action.replace(/_/g, " ")}
                    {event.assigned_pandit_name ? `: ${event.assigned_pandit_name}` : ""}
                    {event.note ? ` ("${event.note}")` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {booking.status === "pending_review" && (
            <div className="rounded-xl border border-amber-100 bg-white p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Share a Quote</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={quoteAmount}
                  onChange={(event) => setQuoteAmount(event.target.value)}
                  placeholder="Final price (Rs.)"
                  className="rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon"
                />
              </div>
              <textarea
                value={quoteNote}
                onChange={(event) => setQuoteNote(event.target.value)}
                rows={2}
                placeholder="Note for the Yajmaan (optional)"
                className="mt-2 w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon"
              />
              <button
                type="button"
                onClick={handleQuote}
                disabled={quoting}
                className="interactive-button mt-3 rounded-full bg-maroon px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {quoting ? "Sending..." : "Send Quote"}
              </button>
            </div>
          )}

          {booking.status === "quoted" && (
            <p className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-sky-800">
              Awaiting payment from the Yajmaan. You'll be notified once it's received.
            </p>
          )}

          {booking.status === "paid_pending_assignment" && (
            <div className="rounded-xl border border-amber-100 bg-white p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Assign a Pandit Ji</p>
              <select
                value={selectedPanditId}
                onChange={(event) => setSelectedPanditId(event.target.value)}
                className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon"
              >
                <option value="">Select a Pandit Ji...</option>
                {pandits.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name || p.name} {p.city ? `— ${p.city}` : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAssign}
                disabled={assigning}
                className="interactive-button mt-3 rounded-full bg-maroon px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {assigning ? "Assigning..." : "Assign Pandit Ji"}
              </button>
            </div>
          )}

          {["pending_review", "quoted", "paid_pending_assignment"].includes(booking.status) && (
            <button
              type="button"
              onClick={() => setCancelOpen(true)}
              className="interactive-button w-full rounded-full border border-rose-200 px-5 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50"
            >
              Cancel This Request
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={cancelOpen}
        title="Cancel this request?"
        message="The Yajmaan will be notified with your reason."
        confirmLabel={cancelling ? "Cancelling..." : "Cancel Request"}
        confirmClassName="bg-rose-600 hover:bg-rose-700"
        loading={cancelling}
        onConfirm={handleCancel}
        onClose={() => setCancelOpen(false)}
      >
        <textarea
          value={cancelReason}
          onChange={(event) => setCancelReason(event.target.value)}
          rows={2}
          placeholder="Reason (required)"
          className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon"
        />
      </ConfirmDialog>
    </Modal>
  );
}
