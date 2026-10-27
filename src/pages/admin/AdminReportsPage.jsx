import { useEffect, useState } from "react";

import {
  getReportsExportUrl,
  getReportsSummary,
  getReportsTrend,
  getTopCities,
  listAdminPujas,
} from "../../services/adminApi";
import { get } from "../../api";
import StatCard from "../../components/admin/StatCard";
import BookingsTrendChart from "../../components/admin/BookingsTrendChart";
import TopCitiesList from "../../components/admin/TopCitiesList";

const DATE_RANGES = [
  { value: "last_7_days", label: "Last 7 Days" },
  { value: "last_30_days", label: "Last 30 Days" },
  { value: "last_90_days", label: "Last 90 Days" },
];

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function formatDelta(change) {
  if (change === null || change === undefined) return null;
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change}%`;
}

export default function AdminReportsPage() {
  const [dateRange, setDateRange] = useState("last_30_days");
  const [pujaId, setPujaId] = useState("");
  const [city, setCity] = useState("");

  const [pujas, setPujas] = useState([]);
  const [cities, setCities] = useState([]);
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [topCities, setTopCities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAdminPujas({ pageSize: 100 }).then((data) => setPujas(data?.items || [])).catch(() => {});
    get("/cities").then((data) => setCities(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getReportsSummary({ dateRange, pujaId, city }),
      getReportsTrend({ pujaId, city }),
      getTopCities({ dateRange, pujaId }),
    ])
      .then(([summaryData, trendData, citiesData]) => {
        setSummary(summaryData);
        setTrend(trendData?.series || []);
        setTopCities(citiesData?.cities || []);
      })
      .catch(() => {
        setSummary(null);
        setTrend([]);
        setTopCities([]);
      })
      .finally(() => setLoading(false));
  }, [dateRange, pujaId, city]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-xl font-semibold text-maroon">Reports</h1>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-amber-100 bg-white p-4 shadow-sm sm:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Date Range</span>
          <select
            value={dateRange}
            onChange={(event) => setDateRange(event.target.value)}
            className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm outline-none"
          >
            {DATE_RANGES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Puja</span>
          <select
            value={pujaId}
            onChange={(event) => setPujaId(event.target.value)}
            className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm outline-none"
          >
            <option value="">All</option>
            {pujas.map((puja) => (
              <option key={puja.id} value={puja.id}>
                {puja.title}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">City</span>
          <select
            value={city}
            onChange={(event) => setCity(event.target.value)}
            className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm outline-none"
          >
            <option value="">All</option>
            {cities.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end">
          <a
            href={getReportsExportUrl({ dateRange, pujaId, city })}
            className="interactive-button flex w-full items-center justify-center gap-2 rounded-full border border-amber-200 px-4 py-2 text-sm font-semibold text-maroon hover:bg-amber-50"
          >
            ⬇ Download
          </a>
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading reports...</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total Bookings"
              value={summary?.total_bookings ?? 0}
              delta={formatDelta(summary?.total_bookings_change)}
              deltaPositive={(summary?.total_bookings_change ?? 0) >= 0}
            />
            <StatCard
              label="Total Revenue"
              value={formatCurrency(summary?.total_revenue)}
              delta={formatDelta(summary?.total_revenue_change)}
              deltaPositive={(summary?.total_revenue_change ?? 0) >= 0}
              accent="emerald"
            />
            <StatCard
              label="Unique Users"
              value={summary?.unique_users ?? 0}
              delta={formatDelta(summary?.unique_users_change)}
              deltaPositive={(summary?.unique_users_change ?? 0) >= 0}
              accent="saffron"
            />
            <StatCard
              label="Avg Order Value"
              value={formatCurrency(summary?.avg_order_value)}
              delta={formatDelta(summary?.avg_order_value_change)}
              deltaPositive={(summary?.avg_order_value_change ?? 0) >= 0}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <BookingsTrendChart series={trend} />
            <TopCitiesList cities={topCities} />
          </div>
        </>
      )}
    </div>
  );
}
