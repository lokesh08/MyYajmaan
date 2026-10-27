import { useEffect, useState } from "react";
import useLiveRefresh from "../../hooks/useLiveRefresh";
import { Link } from "react-router-dom";

import {
  getBookingsByStatus,
  getBookingsOverview,
  getDashboardSummary,
  getDeclineAlerts,
  getRecentBookings,
  getTopPujas,
} from "../../services/adminApi";
import StatCard from "../../components/admin/StatCard";
import BookingsOverviewChart from "../../components/admin/BookingsOverviewChart";
import BookingsStatusPie from "../../components/admin/BookingsStatusPie";
import RecentBookingsTable from "../../components/admin/RecentBookingsTable";
import TopPujaList from "../../components/admin/TopPujaList";

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState(null);
  const [overview, setOverview] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [recentBookings, setRecentBookings] = useState([]);
  const [topPujas, setTopPujas] = useState([]);
  const [declineAlerts, setDeclineAlerts] = useState([]);

  function loadDashboard() {
    getDashboardSummary().then(setSummary).catch(() => setSummary(null));
    getBookingsOverview(7).then((data) => setOverview(data?.series || [])).catch(() => setOverview([]));
    getBookingsByStatus().then((data) => setStatuses(data?.statuses || [])).catch(() => setStatuses([]));
    getRecentBookings(5).then((data) => setRecentBookings(data?.bookings || [])).catch(() => setRecentBookings([]));
    getTopPujas(5).then((data) => setTopPujas(data?.pujas || [])).catch(() => setTopPujas([]));
    getDeclineAlerts().then((data) => setDeclineAlerts(data?.items || [])).catch(() => setDeclineAlerts([]));
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  // New booking / decline notifications refresh every widget in place.
  useLiveRefresh(loadDashboard);

  return (
    <div className="space-y-6">
      {declineAlerts.length > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="font-semibold text-rose-800">
            ⚠️ {declineAlerts.length} Pandit Ji need{declineAlerts.length === 1 ? "s" : ""} attention -- 3+ declines in a row
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {declineAlerts.map((alert) => (
              <Link
                key={alert.pandit_id}
                to="/admin/pandits"
                title={`${alert.name}: ${alert.current_streak} declines in a row`}
                className="interactive-button rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-rose-700 shadow-sm hover:bg-rose-100"
              >
                {alert.name}{alert.city ? ` (${alert.city})` : ""} -- {alert.current_streak} in a row
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Users" value={summary?.total_users ?? "—"} to="/admin/users" />
        <StatCard label="Total Pandit Ji" value={summary?.total_pandits ?? "—"} accent="saffron" to="/admin/pandits" />
        <StatCard label="Total Bookings" value={summary?.total_bookings ?? "—"} to="/admin/bookings" />
        <StatCard label="Revenue (This Month)" value={`₹${(summary?.revenue_this_month ?? 0).toLocaleString("en-IN")}`} accent="emerald" to="/admin/reports" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <BookingsOverviewChart series={overview} />
        <BookingsStatusPie statuses={statuses} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentBookingsTable bookings={recentBookings} />
        <TopPujaList pujas={topPujas} />
      </div>
    </div>
  );
}
