import { useEffect, useState } from "react";
import useLiveRefresh from "../../hooks/useLiveRefresh";
import { Link } from "react-router-dom";

import { usePanditPortal } from "../../context/PanditPortalContext";
import { getMyBookingTabCounts, getMyWallet, listMyBookings, listMyDeclinedHistory } from "../../services/panditApi";
import LockedNotice from "../../components/pandit/LockedNotice";

function StatCard({ label, value, accent = "text-maroon", to }) {
  const content = (
    <>
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className={`mt-2 font-serif text-2xl font-semibold ${accent}`}>{value}</p>
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        title={`View ${label.toLowerCase()}`}
        className="interactive-button block rounded-2xl border border-amber-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-saffron/40 hover:shadow-md"
      >
        {content}
      </Link>
    );
  }

  return <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">{content}</div>;
}

export default function PanditDashboardPage() {
  const { stage, rejectionReason, displayName } = usePanditPortal();
  const [counts, setCounts] = useState({ upcoming: 0, completed: 0, cancelled: 0 });
  const [declinedCount, setDeclinedCount] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);

  function loadOverview({ silent = false } = {}) {
    if (stage !== "approved") return;

    if (!silent) setLoading(true);
    Promise.all([
      getMyBookingTabCounts(),
      getMyWallet({ page: 1, pageSize: 1 }),
      listMyBookings({ tab: "upcoming", page: 1, pageSize: 5 }),
      // Durable count: bookings.status only reflects a decline while it's
      // still linked to this pandit -- admin reassigning it away
      // overwrites pandit_id, so the tab-counts endpoint above silently
      // undercounts. This reads from booking_assignment_events instead,
      // same source PanditBookingsPage.jsx's Declined tab uses, so the
      // number here always matches what that tab shows.
      listMyDeclinedHistory({ page: 1, pageSize: 1 }),
    ])
      .then(([countsData, walletData, upcomingData, declinedData]) => {
        setCounts(countsData || { upcoming: 0, completed: 0, cancelled: 0 });
        setWalletBalance(walletData?.balance || 0);
        setUpcoming(upcomingData?.items || []);
        setDeclinedCount(declinedData?.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadOverview();
  }, [stage]);

  // A new booking request / cancellation notification refreshes the
  // counts and upcoming list in place.
  useLiveRefresh(() => loadOverview({ silent: true }));

  if (stage !== "approved") {
    return <LockedNotice stage={stage} rejectionReason={rejectionReason} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-maroon">Welcome, {displayName || "Pandit Ji"} 🙏</h1>
        <p className="text-sm text-slate-500">Here's an overview of your bookings and earnings.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Upcoming Bookings" value={counts.upcoming} to="/pandit/bookings?tab=upcoming" />
        <StatCard label="Completed Bookings" value={counts.completed} accent="text-emerald-600" to="/pandit/bookings?tab=completed" />
        <StatCard label="Cancelled" value={counts.cancelled} accent="text-slate-500" to="/pandit/bookings?tab=cancelled" />
        <StatCard label="Declined Bookings" value={declinedCount} accent="text-rose-500" to="/pandit/bookings?tab=declined" />
        <StatCard label="Wallet Balance" value={`Rs. ${walletBalance.toFixed(2)}`} accent="text-amber-600" to="/pandit/wallet" />
      </div>

      <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold text-maroon">Upcoming Bookings</h2>
          <Link to="/pandit/bookings" title="View all bookings" className="text-sm font-semibold text-maroon hover:underline">
            View all
          </Link>
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-slate-400">Loading...</p>
        ) : upcoming.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No upcoming bookings right now.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="pb-2">Customer</th>
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Timeslot</th>
                  <th className="pb-2">Amount</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-50">
                {upcoming.map((booking) => (
                  <tr key={booking.id}>
                    <td className="py-2">{booking.customer_name || "Customer"}</td>
                    <td className="py-2">{booking.booking_date || booking.date || "—"}</td>
                    <td className="py-2">{booking.muhurat_time_slot || booking.timeslot || "—"}</td>
                    <td className="py-2">Rs. {Number(booking.amount || 0).toFixed(2)}</td>
                    <td className="py-2 capitalize">{booking.status === "pending_pandit" ? "Awaiting your response" : booking.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
