import { useEffect, useRef, useState } from "react";
import useLiveRefresh from "../../hooks/useLiveRefresh";

import Modal from "../../components/Modal";
import {
  getAdminBooking,
  getBookingInvoiceUrl,
  listAdminBookings,
  listDeclinedBookingHistory,
  listEligiblePandits,
  reassignAdminBooking,
} from "../../services/adminApi";
import { showError, showSuccess } from "../../utils/toaster";

const STATUS_OPTIONS = [
  { key: "all", label: "All" },
  { key: "pending_pandit", label: "Awaiting Pandit" },
  { key: "declined", label: "Needs Reassignment" },
  { key: "confirmed", label: "Confirmed" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "declined_history", label: "Declined" },
];

const STATUS_STYLES = {
  pending_pandit: "bg-amber-50 text-amber-700",
  declined: "bg-rose-50 text-rose-700",
  confirmed: "bg-sky-50 text-sky-700",
  completed: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-600",
};

function StatusPill({ status }) {
  const labels = {
    pending_pandit: "Awaiting Pandit",
    declined: "Needs Reassignment",
    confirmed: "Confirmed",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status] || "bg-slate-100 text-slate-600"}`}>
      {labels[status] || status || "Unknown"}
    </span>
  );
}

function ReassignModal({ booking, open, onClose, onSaved }) {
  const [pandits, setPandits] = useState([]);
  const [panditId, setPanditId] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !booking?.id) return;
    setPanditId("");
    setNote("");
    setLoading(true);
    listEligiblePandits(booking.id)
      .then((data) => setPandits(data?.items || []))
      .catch(() => {
        setPandits([]);
        showError("Could not load eligible Pandit Ji.");
      })
      .finally(() => setLoading(false));
  }, [open, booking?.id]);

  async function handleSubmit() {
    if (!panditId) {
      showError("Choose a replacement Pandit Ji.");
      return;
    }
    setSaving(true);
    try {
      const result = await reassignAdminBooking(booking.id, panditId, note.trim());
      const covered = Number(result?.platform_covered_amount || 0);
      showSuccess(covered > 0 ? `Booking reassigned. MyYajmaan covers Rs. ${covered.toFixed(2)}.` : result?.message || "Booking reassigned.");
      onSaved();
      onClose();
    } catch (error) {
      showError(error?.message || "Could not reassign this booking.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Assign Replacement Pandit Ji" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">The customer keeps their original booking amount. Any higher replacement rate is recorded as a MyYajmaan-covered amount.</p>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Eligible Pandit Ji</span>
          <select value={panditId} disabled={loading || saving} onChange={(event) => setPanditId(event.target.value)} className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon">
            <option value="">{loading ? "Loading eligible Pandit Ji..." : "Select Pandit Ji"}</option>
            {pandits.map((pandit) => (
              <option key={pandit.id} value={pandit.id}>
                {pandit.display_name || pandit.name} {pandit.city ? `(${pandit.city})` : ""} - Rs. {Number(pandit.price || 0).toFixed(2)}
              </option>
            ))}
          </select>
        </label>
        {!loading && pandits.length === 0 && <p className="text-sm text-rose-600">No approved Pandit Ji currently offers this puja.</p>}
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Internal Note</span>
          <textarea value={note} disabled={saving} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Reason for reassignment or call outcome" className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon" />
        </label>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={onClose} disabled={saving} className="interactive-button rounded-full border border-amber-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-amber-50">Cancel</button>
        <button type="button" onClick={handleSubmit} disabled={saving || loading || pandits.length === 0} className="interactive-button rounded-full bg-maroon px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Assigning..." : "Assign & Confirm"}</button>
      </div>
    </Modal>
  );
}

function formatDateTime(isoString) {
  if (!isoString) return null;
  try {
    return new Date(isoString).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

const PAYMENT_METHOD_LABELS = { upi: "UPI", card: "Card", wallet: "Wallet" };

function DetailField({ label, value, className = "" }) {
  if (!value) return null;
  return (
    <div className={className}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-semibold text-slate-800">{value}</p>
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

function PujaPhotosCard({ photos }) {
  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">Puja Completion Photos</p>
      {photos.length === 0 ? (
        <p className="mt-1 text-slate-500">Pandit Ji hasn't uploaded any photos for this booking yet.</p>
      ) : (
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo) => (
            <a
              key={photo.id}
              href={photo.image_url}
              target="_blank"
              rel="noreferrer"
              title="Open full-size photo"
              className="interactive-button block overflow-hidden rounded-lg border border-amber-200"
            >
              <img src={photo.image_url} alt="Puja completion" className="h-24 w-full object-cover transition hover:scale-105" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function BookingDetailModal({ bookingId, open, onClose, onReassign }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !bookingId) return;
    setLoading(true);
    getAdminBooking(bookingId).then(setDetail).catch(() => setDetail(null)).finally(() => setLoading(false));
  }, [open, bookingId]);

  const booking = detail?.booking;

  async function copyBookingId() {
    try {
      await navigator.clipboard.writeText(booking.id);
      showSuccess("Booking ID copied.");
    } catch {
      showError("Could not copy the booking ID.");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Booking Details" size="lg">
      {loading ? <p className="py-10 text-center text-sm text-slate-400">Loading booking...</p> : !booking ? <p className="py-10 text-center text-sm text-rose-600">Could not load this booking.</p> : (
        <div className="space-y-5 text-sm">
          {/* Header strip: identity, status, and the booked-on vs puja-on distinction */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-100 bg-white p-3">
            <div className="flex items-center gap-2">
              <button type="button" onClick={copyBookingId} title="Copy booking ID" className="interactive-button rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-600 hover:bg-slate-200">
                #{booking.id.slice(0, 8)}
              </button>
              <StatusPill status={booking.status} />
            </div>
            <div className="flex flex-wrap gap-4 text-xs">
              <div><span className="text-slate-500">Booked on: </span><span className="font-semibold text-slate-700">{formatDateTime(booking.created_at) || "—"}</span></div>
              <div><span className="text-slate-500">Puja on: </span><span className="font-semibold text-slate-700">{booking.booking_date || booking.date} • {booking.muhurat_time_slot || booking.timeslot}</span></div>
            </div>
          </div>

          {/* Puja & payment */}
          <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Puja & Payment</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              <DetailField label="Puja" value={booking.puja_title} />
              <DetailField label="Package" value={booking.package_tier === "premium" ? "Premium" : booking.package_tier === "basic" ? "Basic" : null} />
              <DetailField label="Amount Paid" value={`Rs. ${Number(booking.amount || 0).toFixed(2)}`} />
              <DetailField label="Mode of Booking" value={PAYMENT_METHOD_LABELS[booking.payment_method] || booking.payment_method} />
              <DetailField label="Payment Reference" value={booking.payment_ref} />
              {booking.coupon && (
                <DetailField
                  label="Coupon Applied"
                  value={`${booking.coupon.code} (-Rs. ${Number(booking.coupon_discount || 0).toFixed(2)})`}
                />
              )}
              {Number(booking.premium_fee || 0) > 0 && (
                <DetailField label="Premium Fee" value={`Rs. ${Number(booking.premium_fee).toFixed(2)}`} />
              )}
              {Number(booking.gst_amount || 0) > 0 && (
                <DetailField label="GST" value={`Rs. ${Number(booking.gst_amount).toFixed(2)}`} />
              )}
              {Number(booking.platform_fee || 0) > 0 && (
                <DetailField label="Platform Fee" value={`Rs. ${Number(booking.platform_fee).toFixed(2)}`} />
              )}
              {Number(booking.cashback_applied || 0) > 0 && (
                <DetailField label="Cashback Applied" value={`Rs. ${Number(booking.cashback_applied).toFixed(2)}`} />
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-amber-100 pt-3">
              {booking.status === "completed" ? (
                <>
                  <a
                    href={getBookingInvoiceUrl(booking.id, "customer")}
                    target="_blank"
                    rel="noreferrer"
                    className="interactive-button rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-maroon hover:bg-amber-50"
                  >
                    Download Customer Invoice
                  </a>
                  <a
                    href={getBookingInvoiceUrl(booking.id, "pandit")}
                    target="_blank"
                    rel="noreferrer"
                    className="interactive-button rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-maroon hover:bg-amber-50"
                  >
                    Download Pandit Invoice
                  </a>
                </>
              ) : (
                <span className="text-xs text-slate-400" title="Available once this puja is marked completed">
                  Invoices available once completed
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
              <p className="text-xs font-semibold uppercase text-slate-500">Customer</p>
              <p className="mt-1 font-semibold text-slate-800">{booking.customer?.full_name || "Customer"}</p>
              <p className="text-slate-600">{booking.customer?.phone || booking.customer?.email || "No contact available"}</p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
              <p className="text-xs font-semibold uppercase text-slate-500">Assignment</p>
              <p className="mt-1 font-semibold text-slate-800">{booking.pandit?.display_name || booking.pandit?.name || "Unassigned"}</p>
              <p className="text-slate-600">{[booking.pandit?.city, booking.pandit?.phone].filter(Boolean).join(" • ") || ""}</p>
            </div>
          </div>

          <AddressCard booking={booking} />

          {booking.special_instructions && (
            <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
              <p className="text-xs font-semibold uppercase text-slate-500">Special Instructions</p>
              <p className="mt-1 text-slate-700">{booking.special_instructions}</p>
            </div>
          )}

          <PujaPhotosCard photos={detail.photos || []} />

          {booking.rescheduled_at && (
            <div className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-sky-900">
              <p className="font-semibold">Rescheduled</p>
              <p className="mt-1">
                Originally {booking.original_booking_date} • {booking.original_muhurat_time_slot}, moved to {booking.booking_date || booking.date} • {booking.muhurat_time_slot || booking.timeslot} on {formatDateTime(booking.rescheduled_at)}.
                {Number(booking.reschedule_fee_charged || 0) > 0 && ` Reschedule fee charged: Rs. ${Number(booking.reschedule_fee_charged).toFixed(2)}.`}
              </p>
            </div>
          )}

          {booking.status === "cancelled" && (
            <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-rose-800">
              <p className="font-semibold">Cancelled{booking.cancelled_reason ? "" : " by customer"}</p>
              {booking.cancelled_reason && <p className="mt-1">{booking.cancelled_reason}</p>}
              <p className="mt-1 text-xs">
                {Number(booking.cancellation_fee || 0) > 0 && `Cancellation fee: Rs. ${Number(booking.cancellation_fee).toFixed(2)}. `}
                {Number(booking.refund_amount || 0) > 0 && `Refunded to wallet: Rs. ${Number(booking.refund_amount).toFixed(2)}.`}
              </p>
            </div>
          )}

          {booking.status === "declined" && booking.cancelled_reason && (
            <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-rose-800">
              <p className="font-semibold">Pandit Ji decline reason</p>
              <p className="mt-1">{booking.cancelled_reason}</p>
            </div>
          )}

          <div><p className="mb-2 text-xs font-semibold uppercase text-slate-500">Assignment history</p>{detail.assignment_history?.length ? <div className="space-y-2">{detail.assignment_history.map((event) => <div key={event.id} className="rounded-lg border border-slate-100 px-3 py-2"><span className="font-semibold capitalize">{event.action.replaceAll("_", " ")}</span>{event.note ? <span className="text-slate-600">: {event.note}</span> : null}{Number(event.platform_covered_amount || 0) > 0 ? <span className="text-emerald-700">. Platform covered Rs. {Number(event.platform_covered_amount).toFixed(2)}</span> : null}</div>)}</div> : <p className="text-slate-500">No recorded assignment events.</p>}</div>
          {booking.status === "declined" && <div className="flex justify-end"><button type="button" onClick={() => { onClose(); onReassign(booking); }} className="interactive-button rounded-full bg-maroon px-4 py-2 text-sm font-semibold text-white">Assign Replacement</button></div>}
        </div>
      )}
    </Modal>
  );
}

export default function AdminBookingsPage() {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [reassignBooking, setReassignBooking] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const silentRef = useRef(false);

  useLiveRefresh(() => {
    silentRef.current = true;
    setRefreshKey((key) => key + 1);
  });

  useEffect(() => {
    if (!silentRef.current) setLoading(true);
    const request = status === "declined_history"
      ? listDeclinedBookingHistory({})
      : listAdminBookings({ status, search: search.trim() });
    request
      .then((data) => setItems(data?.items || []))
      .catch(() => {
        if (silentRef.current) return;
        setItems([]);
        showError("Could not load bookings.");
      })
      .finally(() => {
        setLoading(false);
        silentRef.current = false;
      });
  }, [status, search, refreshKey]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="font-serif text-2xl font-semibold text-maroon">Booking Operations</h1><p className="mt-1 text-sm text-slate-500">Monitor customer requests, Pandit Ji responses, and reassignment work.</p></div><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, Pandit Ji, or puja" className="w-full rounded-full border border-amber-200 px-4 py-2 text-sm outline-none focus:border-maroon sm:w-72" /></div>
      <div className="flex flex-wrap gap-2 rounded-full border border-amber-100 bg-white p-1">{STATUS_OPTIONS.map((option) => <button key={option.key} type="button" onClick={() => setStatus(option.key)} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${status === option.key ? "bg-maroon text-white" : "text-slate-600 hover:bg-amber-50"}`}>{option.label}</button>)}</div>
      {loading ? <p className="py-12 text-center text-sm text-slate-400">Loading bookings...</p> : items.length === 0 ? <div className="rounded-2xl border border-amber-100 bg-white p-10 text-center text-sm text-slate-400">{status === "declined_history" ? "No booking has ever been declined." : "No bookings match these filters."}</div> : status === "declined_history" ? <div className="overflow-x-auto rounded-2xl border border-amber-100 bg-white shadow-sm"><table className="w-full min-w-[920px] text-left text-sm"><thead className="bg-amber-50/60 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Customer & Puja</th><th className="px-4 py-3">Declined By</th><th className="px-4 py-3">Reassigned To</th><th className="px-4 py-3">Declined On</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-amber-50">{items.map((entry) => <tr key={entry.booking?.id + entry.declined_at}><td className="px-4 py-3"><p className="font-semibold text-slate-800">{entry.booking?.customer?.full_name || "Customer"}</p><p className="text-xs text-slate-500">{entry.booking?.puja_title}</p></td><td className="px-4 py-3 text-rose-700">{entry.declined_by?.display_name || entry.declined_by?.name || "Unknown"}</td><td className="px-4 py-3">{entry.reassigned_to ? <span className="text-emerald-700">{entry.reassigned_to.display_name || entry.reassigned_to.name}</span> : <span className="text-slate-400">Not yet reassigned</span>}</td><td className="px-4 py-3 text-xs text-slate-500">{entry.declined_at ? new Date(entry.declined_at).toLocaleDateString() : "—"}</td><td className="max-w-xs px-4 py-3 text-xs italic text-slate-500">"{entry.decline_reason || "No reason given"}"</td><td className="px-4 py-3 text-right"><button type="button" onClick={() => setSelectedId(entry.booking?.id)} className="interactive-button rounded-full border border-amber-200 px-3 py-1.5 text-xs font-semibold text-maroon hover:bg-amber-50">View</button></td></tr>)}</tbody></table></div> : <div className="overflow-x-auto rounded-2xl border border-amber-100 bg-white shadow-sm"><table className="w-full min-w-[920px] text-left text-sm"><thead className="bg-amber-50/60 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Puja & Schedule</th><th className="px-4 py-3">Assigned Pandit Ji</th><th className="px-4 py-3">Customer Paid</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-amber-50">{items.map((booking) => <tr key={booking.id}><td className="px-4 py-3"><p className="font-semibold text-slate-800">{booking.customer?.full_name || "Customer"}</p><p className="text-xs text-slate-500">{booking.customer?.phone || booking.customer?.email || ""}</p></td><td className="px-4 py-3"><p className="font-medium">{booking.puja_title}</p><p className="text-xs text-slate-500">{booking.booking_date || booking.date} {booking.muhurat_time_slot || booking.timeslot}</p></td><td className="px-4 py-3">{booking.pandit?.display_name || booking.pandit?.name || "Unassigned"}</td><td className="px-4 py-3">Rs. {Number(booking.amount || 0).toFixed(2)}</td><td className="px-4 py-3"><StatusPill status={booking.status} /></td><td className="px-4 py-3 text-right"><button type="button" onClick={() => setSelectedId(booking.id)} className="interactive-button rounded-full border border-amber-200 px-3 py-1.5 text-xs font-semibold text-maroon hover:bg-amber-50">View</button>{booking.status === "declined" && <button type="button" onClick={() => setReassignBooking(booking)} className="interactive-button ml-2 rounded-full bg-maroon px-3 py-1.5 text-xs font-semibold text-white">Assign</button>}</td></tr>)}</tbody></table></div>}
      <BookingDetailModal bookingId={selectedId} open={Boolean(selectedId)} onClose={() => setSelectedId(null)} onReassign={setReassignBooking} />
      <ReassignModal booking={reassignBooking} open={Boolean(reassignBooking)} onClose={() => setReassignBooking(null)} onSaved={() => setRefreshKey((key) => key + 1)} />
    </div>
  );
}