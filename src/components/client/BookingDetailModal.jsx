import { useEffect, useState } from "react";

import Modal from "../Modal";
import { getMyBookingDetail } from "../../services/clientApi";
import { addComplaintMessage, getComplaintForBooking, raiseComplaint } from "../../services/complaintsApi";
import { showError, showSuccess } from "../../utils/toaster";
import { panditPlaceholderImage } from "../../constants/visualAssets";

const STATUS_STYLES = {
  pending_pandit: "bg-amber-50 text-amber-700",
  confirmed: "bg-sky-50 text-sky-700",
  completed: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-500",
  declined: "bg-amber-50 text-amber-700",
};
const STATUS_LABELS = {
  pending_pandit: "Awaiting Confirmation",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  declined: "Awaiting Confirmation",
};

const COMPLAINT_STATUS_STYLES = { open: "bg-amber-50 text-amber-700", in_progress: "bg-sky-50 text-sky-700", resolved: "bg-emerald-50 text-emerald-700" };
const COMPLAINT_STATUS_LABELS = { open: "Not Viewed", in_progress: "In Progress", resolved: "Completed" };

function timeAgo(isoString) {
  if (!isoString) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function PanditCard({ booking }) {
  if (!booking.pandit_details_available) {
    return (
      <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
        <p className="text-xs font-semibold uppercase text-slate-500">Pandit Ji</p>
        <p className="mt-1 text-slate-500">
          Pandit Ji's details will appear here once they confirm your booking. You'll see their full profile,
          rating, and contact number right here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">Pandit Ji</p>
      <div className="mt-2 flex items-center gap-3">
        <img
          src={booking.pandit_avatar || panditPlaceholderImage}
          alt={booking.pandit_name || "Pandit Ji"}
          className="h-14 w-14 shrink-0 rounded-full object-cover shadow-sm"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = panditPlaceholderImage;
          }}
        />
        <div>
          <p className="font-semibold text-slate-800">{booking.pandit_name || "Pandit Ji"}</p>
          <p className="text-xs text-slate-500">
            {booking.pandit_city}
            {booking.pandit_rating ? ` • ⭐ ${Number(booking.pandit_rating).toFixed(1)}` : ""}
            {booking.pandit_experience_years ? ` • ${booking.pandit_experience_years} yrs experience` : ""}
          </p>
        </div>
      </div>
      {booking.pandit_languages?.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">Languages: {booking.pandit_languages.join(", ")}</p>
      )}
      {booking.pandit_about && <p className="mt-2 text-slate-600">{booking.pandit_about}</p>}
      {booking.pandit_phone && (
        <a href={`tel:${booking.pandit_phone}`} className="interactive-button mt-3 inline-flex rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-maroon hover:bg-amber-50">
          📞 {booking.pandit_phone}
        </a>
      )}
    </div>
  );
}

function AddressCard({ booking }) {
  const hasAddress = booking.address_line || booking.address_city;
  if (!hasAddress) {
    return (
      <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
        <p className="text-xs font-semibold uppercase text-slate-500">Address</p>
        <p className="mt-1 text-slate-500">No address on file for this booking.</p>
      </div>
    );
  }

  const addressParts = [booking.address_line, booking.address_city, booking.address_state, booking.address_pincode].filter(Boolean);
  const fullAddress = addressParts.join(", ");
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(fullAddress);
      showSuccess("Address copied.");
    } catch {
      showError("Could not copy the address.");
    }
  }

  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">Address</p>
      {(booking.contact_name || booking.contact_phone) && (
        <p className="mt-1 font-semibold text-slate-800">
          {booking.contact_name} {booking.contact_phone ? `• ${booking.contact_phone}` : ""}
        </p>
      )}
      <p className="mt-1 text-slate-600">{fullAddress}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          title="Open this address in Google Maps"
          className="interactive-button rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-maroon hover:bg-amber-50"
        >
          📍 View on Map
        </a>
        <button
          type="button"
          onClick={copyAddress}
          title="Copy the full address"
          className="interactive-button rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-maroon hover:bg-amber-50"
        >
          Copy address
        </button>
      </div>
    </div>
  );
}

function ComplaintThread({ complaint, onMessageSent }) {
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await addComplaintMessage(complaint.id, reply.trim());
      setReply("");
      onMessageSent();
    } catch (error) {
      showError(error?.data?.detail?.message || error?.message || "Could not send this message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase text-slate-500">Complaint: {complaint.subject}</p>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${COMPLAINT_STATUS_STYLES[complaint.status]}`}>
          {COMPLAINT_STATUS_LABELS[complaint.status]}
        </span>
      </div>

      <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
        {(complaint.messages || []).map((msg) => (
          <div key={msg.id} className={`rounded-lg p-2.5 text-sm ${msg.sender_role === "admin" ? "bg-white" : "bg-maroon/5"}`}>
            <p className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-600">
              <span>{msg.sender_role === "admin" ? "MyYajmaan Support" : "You"}</span>
              <span className="font-normal text-slate-400">{timeAgo(msg.created_at)}</span>
            </p>
            <p className="mt-1 text-slate-700">{msg.body}</p>
          </div>
        ))}
      </div>

      {complaint.status === "resolved" ? (
        <p className="mt-3 text-xs text-slate-500">
          This complaint is resolved.
          {complaint.resolution === "valid" && complaint.refund_amount
            ? ` Rs. ${Number(complaint.refund_amount).toFixed(2)} was refunded to your wallet.`
            : ""}
        </p>
      ) : (
        <div className="mt-3 flex gap-2">
          <input
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            placeholder="Add a message..."
            className="flex-1 rounded-lg border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !reply.trim()}
            className="interactive-button rounded-lg bg-maroon px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}

function RaiseComplaintForm({ bookingId, onRaised }) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!subject.trim() || description.trim().length < 10) {
      showError("Please enter a subject and describe the issue (at least 10 characters).");
      return;
    }
    setSubmitting(true);
    try {
      await raiseComplaint({ bookingId, subject: subject.trim(), description: description.trim() });
      showSuccess("Your complaint has been raised. Our team will review it shortly.");
      onRaised();
    } catch (error) {
      showError(error?.data?.detail?.message || error?.message || "Could not raise this complaint.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">Raise a Complaint</p>
      <p className="mt-1 text-xs text-slate-500">Had an issue with this puja? Let us know and our team will look into it.</p>
      <input
        value={subject}
        onChange={(event) => setSubject(event.target.value)}
        placeholder="Subject (e.g. Pandit Ji arrived late)"
        className="mt-2 w-full rounded-lg border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon"
      />
      <textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        rows={3}
        placeholder="Describe what happened..."
        className="mt-2 w-full rounded-lg border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="interactive-button mt-2 rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Submitting..." : "Submit Complaint"}
      </button>
    </div>
  );
}

export default function BookingDetailModal({ booking, open, onClose }) {
  const [detail, setDetail] = useState(null);
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(false);

  function loadComplaint(bookingId) {
    getComplaintForBooking(bookingId)
      .then((data) => setComplaint(data?.complaint || null))
      .catch(() => {});
  }

  useEffect(() => {
    if (!open || !booking) return;
    setLoading(true);
    setDetail(null);
    setComplaint(null);
    getMyBookingDetail(booking.id)
      .then((data) => setDetail(data?.booking || null))
      .catch(() => showError("Could not load booking details."))
      .finally(() => setLoading(false));
    if (booking.status === "completed") loadComplaint(booking.id);
  }, [open, booking]);

  if (!booking) return null;

  return (
    <Modal open={open} onClose={onClose} title="Booking Details" size="lg">
      {loading || !detail ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading...</p>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-100 bg-white p-3">
            <div>
              <p className="font-serif text-lg font-semibold text-maroon">{detail.puja_title || "Puja"}</p>
              <p className="text-xs text-slate-500">
                {detail.booking_date || detail.date} • {detail.muhurat_time_slot || detail.timeslot}
              </p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[detail.status] || "bg-slate-100 text-slate-500"}`}>
              {STATUS_LABELS[detail.status] || detail.status}
            </span>
          </div>

          <PanditCard booking={detail} />
          <AddressCard booking={detail} />

          {detail.special_instructions && (
            <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
              <p className="text-xs font-semibold uppercase text-slate-500">Special Instructions</p>
              <p className="mt-1 text-slate-600">{detail.special_instructions}</p>
            </div>
          )}

          {detail.status === "completed" && (
            complaint ? (
              <ComplaintThread complaint={complaint} onMessageSent={() => loadComplaint(booking.id)} />
            ) : (
              <RaiseComplaintForm bookingId={booking.id} onRaised={() => loadComplaint(booking.id)} />
            )
          )}
        </div>
      )}
    </Modal>
  );
}
