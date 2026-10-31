import { useEffect, useState } from "react";
import useLiveRefresh from "../../hooks/useLiveRefresh";
import { Link } from "react-router-dom";

import { useClientPortal } from "../../context/ClientPortalContext";
import { getMyBookingCounts, getMyClientWallet, listMyClientBookings } from "../../services/clientApi";
import { t } from "../../i18n";

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
        title={t("View {v0}", { v0: label.toLowerCase() })}
        className="interactive-button block rounded-2xl border border-amber-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-saffron/40 hover:shadow-md"
      >
        {content}
      </Link>
    );
  }

  return <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">{content}</div>;
}

export default function ClientDashboardPage() {
  const { profile } = useClientPortal();
  const [counts, setCounts] = useState({ upcoming: 0, completed: 0, cancelled: 0 });
  const [walletBalance, setWalletBalance] = useState(0);
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);

  function loadOverview({ silent = false } = {}) {
    if (!silent) setLoading(true);
    return Promise.all([getMyBookingCounts(), getMyClientWallet({ page: 1, pageSize: 1 }), listMyClientBookings({ tab: "upcoming", page: 1, pageSize: 5 })])
      .then(([countsData, walletData, upcomingData]) => {
        setCounts(countsData || { upcoming: 0, completed: 0, cancelled: 0 });
        setWalletBalance(walletData?.balance || 0);
        setUpcoming(upcomingData?.items || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadOverview();
  }, []);

  // e.g. Pandit Ji confirms a puja -> the counts and list update here
  // without the customer touching anything.
  useLiveRefresh(() => loadOverview({ silent: true }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-maroon">{t("Welcome,")}{' '}{profile?.full_name || "there"} 🙏</h1>
        <p className="text-sm text-slate-500">{t("Here's an overview of your pujas and wallet.")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("Upcoming Bookings")} value={counts.upcoming} to="/dashboard/bookings?tab=upcoming" />
        <StatCard label={t("Completed Bookings")} value={counts.completed} accent="text-emerald-600" to="/dashboard/bookings?tab=completed" />
        <StatCard label={t("Cancelled")} value={counts.cancelled} accent="text-rose-500" to="/dashboard/bookings?tab=cancelled" />
        <StatCard label={t("Wallet Balance")} value={`Rs. ${walletBalance.toFixed(2)}`} accent="text-amber-600" to="/dashboard/wallet" />
      </div>

      <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold text-maroon">{t("Upcoming Bookings")}</h2>
          <Link to="/dashboard/bookings" title={t("View all bookings")} className="text-sm font-semibold text-maroon hover:underline">
            {t("View all")}
          </Link>
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-slate-400">{t("Loading...")}</p>
        ) : upcoming.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-400">
            {t("No upcoming bookings.")}{" "}
            <Link to="/book" title={t("Book a puja")} className="font-semibold text-maroon hover:underline">
              {t("Book a puja →")}
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="pb-2">{t("Pandit Ji")}</th>
                  <th className="pb-2">{t("Date")}</th>
                  <th className="pb-2">{t("Timeslot")}</th>
                  <th className="pb-2">{t("Amount")}</th>
                  <th className="pb-2">{t("Status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-50">
                {upcoming.map((booking) => (
                  <tr key={booking.id}>
                    <td className="py-2">{booking.pandit_name || t("Pandit Ji")}</td>
                    <td className="py-2">{booking.booking_date || booking.date || "—"}</td>
                    <td className="py-2">{booking.muhurat_time_slot || booking.timeslot || "—"}</td>
                    <td className="py-2">{t("Rs.")}{' '}{Number(booking.amount || 0).toFixed(2)}</td>
                    <td className="py-2 capitalize">
                      {booking.status === "pending_pandit" || booking.status === "declined" ? t("Awaiting confirmation") : booking.status}
                    </td>
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
