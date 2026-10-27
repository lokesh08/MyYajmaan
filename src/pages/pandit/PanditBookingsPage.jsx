import { useEffect, useRef, useState } from "react";
import useLiveRefresh from "../../hooks/useLiveRefresh";
import { useSearchParams } from "react-router-dom";

import { usePanditPortal } from "../../context/PanditPortalContext";
import { completeBooking, getMyBookingInvoiceUrl, getMyBookingTabCounts, listMyBookings, listMyDeclinedHistory, respondToBooking } from "../../services/panditApi";
import { showError, showSuccess } from "../../utils/toaster";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import LockedNotice from "../../components/pandit/LockedNotice";

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "declined", label: "Declined" },
];

const PAGE_SIZE = 10;

function StatusPill({ status }) {
  const styles = {
    pending_pandit: "bg-amber-50 text-amber-700",
    confirmed: "bg-sky-50 text-sky-700",
    completed: "bg-emerald-50 text-emerald-700",
    cancelled: "bg-slate-100 text-slate-500",
    declined: "bg-rose-50 text-rose-600",
  };
  const labels = {
    pending_pandit: "Awaiting your response",
    confirmed: "Confirmed",
    completed: "Completed",
    cancelled: "Cancelled",
    declined: "Declined",
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status] || "bg-slate-100 text-slate-500"}`}>
      {labels[status] || status}
    </span>
  );
}

export default function PanditBookingsPage() {
  const { stage, rejectionReason } = usePanditPortal();
  // Lets the dashboard's stat tiles deep-link straight to a tab
  // (e.g. /pandit/bookings?tab=completed) instead of always landing
  // on "Upcoming".
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => {
    const requested = searchParams.get("tab");
    return TABS.some((t) => t.key === requested) ? requested : "upcoming";
  });
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ upcoming: 0, completed: 0, cancelled: 0 });
  const [declinedCount, setDeclinedCount] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [declineTarget, setDeclineTarget] = useState(null);
  const [declineReason, setDeclineReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const silentRef = useRef(false);

  // A new booking request / cancellation notification reloads the
  // list quietly, keeping the current rows on screen meanwhile.
  useLiveRefresh(() => {
    silentRef.current = true;
    setRefreshKey((k) => k + 1);
  });

  useEffect(() => setPage(1), [tab]);

  useEffect(() => {
    if (stage !== "approved") return;
    if (!silentRef.current) setLoading(true);
    const request = tab === "declined"
      ? listMyDeclinedHistory({ page, pageSize: PAGE_SIZE })
      : listMyBookings({ tab, page, pageSize: PAGE_SIZE });
    request
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
  }, [stage, tab, page, refreshKey]);

  useEffect(() => {
    if (stage !== "approved") return;
    getMyBookingTabCounts().then(setCounts).catch(() => {});
  }, [stage, refreshKey]);

  // Own small fetch (not tied to which tab is active) so the "declined
  // in a row" streak and the Declined tab's count badge are both
  // always current, not just when the pandit happens to open that tab.
  useEffect(() => {
    if (stage !== "approved") return;
    listMyDeclinedHistory({ page: 1, pageSize: 1 })
      .then((data) => {
        setDeclinedCount(data?.total || 0);
        setCurrentStreak(Number.isFinite(data?.current_streak) ? data.current_streak : 0);
      })
      .catch(() => {});
  }, [stage, refreshKey]);

  if (stage !== "approved") {
    return <LockedNotice stage={stage} rejectionReason={rejectionReason} />;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function handleAccept(booking) {
    setActionLoading(true);
    try {
      await respondToBooking(booking.id, "accept");
      showSuccess("Booking confirmed.");
      setRefreshKey((k) => k + 1);
    } catch (error) {
      showError(error?.message || "Could not accept this booking.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeclineConfirm() {
    if (!declineTarget) return;
    if (!declineReason.trim()) {
      showError("Please enter a reason for declining.");
      return;
    }
    setActionLoading(true);
    try {
      await respondToBooking(declineTarget.id, "decline", declineReason.trim());
      showSuccess("Booking declined.");
      setDeclineTarget(null);
      setDeclineReason("");
      setRefreshKey((k) => k + 1);
    } catch (error) {
      showError(error?.message || "Could not decline this booking.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleComplete(booking) {
    setActionLoading(true);
    try {
      await completeBooking(booking.id);
      showSuccess("Booking marked as completed.");
      setRefreshKey((k) => k + 1);
    } catch (error) {
      showError(error?.message || "Could not update this booking.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-2xl font-semibold text-maroon">Manage Bookings</h1>

      {currentStreak >= 2 && (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${currentStreak >= 3 ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
          {currentStreak >= 3 ? "⚠️ " : ""}
          You've declined {currentStreak} booking{currentStreak === 1 ? "" : "s"} in a row.
          {currentStreak >= 3 ? " Please accept bookings when you can -- admin has been notified." : " One more decline will flag this to admin."}
        </div>
      )}

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
            {item.label} ({item.key === "declined" ? declinedCount : counts[item.key] ?? 0})
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading bookings...</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-amber-100 bg-white p-8 text-center text-sm text-slate-400">
          No {tab} bookings right now.
        </div>
      ) : tab === "declined" ? (
        <div className="overflow-x-auto rounded-2xl border border-amber-100 bg-white shadow-sm">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="bg-amber-50/60 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Puja</th>
                <th className="px-4 py-3">Original Date</th>
                <th className="px-4 py-3">Declined On</th>
                <th className="px-4 py-3">Your Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-50">
              {items.map((entry) => (
                <tr key={entry.booking?.id}>
                  <td className="px-4 py-3 font-medium text-slate-700">
                    {(entry.booking?.notes || "").replace(/^Puja:\s*/, "") || "Puja"}
                  </td>
                  <td className="px-4 py-3">
                    {entry.booking?.booking_date || entry.booking?.date || "—"} · {entry.booking?.muhurat_time_slot || entry.booking?.timeslot || ""}
                  </td>
                  <td className="px-4 py-3">{entry.declined_at ? new Date(entry.declined_at).toLocaleDateString() : "—"}</td>
                  <td className="max-w-xs px-4 py-3 italic text-slate-500">"{entry.decline_reason || "No reason given"}"</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-amber-100 bg-white shadow-sm">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-amber-50/60 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Customer</th>
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
                    <p className="font-medium text-slate-700">{booking.customer_name || "Customer"}</p>
                    <p className="text-xs text-slate-400">{booking.customer_phone || booking.customer_email || ""}</p>
                    {booking.special_instructions && (
                      <p className="mt-1 max-w-xs text-xs italic text-amber-700" title={booking.special_instructions}>
                        📝 {booking.special_instructions}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">{booking.booking_date || booking.date || "—"}</td>
                  <td className="px-4 py-3">{booking.muhurat_time_slot || booking.timeslot || "—"}</td>
                  <td className="px-4 py-3">Rs. {Number(booking.amount || 0).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={booking.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {booking.status === "pending_pandit" ? (
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleAccept(booking)}
                          className="interactive-button rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => setDeclineTarget(booking)}
                          className="interactive-button rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                        >
                          Decline
                        </button>
                      </div>
                    ) : booking.status === "confirmed" ? (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleComplete(booking)}
                        className="interactive-button rounded-full border border-amber-200 px-3 py-1.5 text-xs font-semibold text-maroon hover:bg-amber-50 disabled:opacity-60"
                      >
                        Mark Completed
                      </button>
                    ) : booking.status === "completed" ? (
                      <a
                        href={getMyBookingInvoiceUrl(booking.id)}
                        target="_blank"
                        rel="noreferrer"
                        title="Download payment statement"
                        className="interactive-button rounded-full border border-amber-200 px-3 py-1.5 text-xs font-semibold text-maroon hover:bg-amber-50"
                      >
                        Download Invoice
                      </a>
                    ) : booking.status === "declined" && booking.cancelled_reason ? (
                      <span className="text-xs italic text-slate-400">"{booking.cancelled_reason}"</span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
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

      <ConfirmDialog
        open={Boolean(declineTarget)}
        title="Decline Booking"
        message="Please share a reason. Admin will be notified to arrange another Pandit Ji for the customer."
        confirmLabel="Decline Booking"
        confirmClassName="bg-rose-600 hover:bg-rose-700"
        loading={actionLoading}
        onConfirm={handleDeclineConfirm}
        onClose={() => {
          setDeclineTarget(null);
          setDeclineReason("");
        }}
      >
        <textarea
          value={declineReason}
          onChange={(e) => setDeclineReason(e.target.value)}
          rows={3}
          placeholder="e.g. Not available at this time slot"
          className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
        />
      </ConfirmDialog>
    </div>
  );
}
