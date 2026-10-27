import { useEffect, useState } from "react";

import { getPanditFeedbackSummary, listPanditFeedback } from "../../services/adminApi";

const PAGE_SIZE = 10;
const RATING_OPTIONS = [
  { value: "", label: "All ratings" },
  { value: "5", label: "★★★★★ (5)" },
  { value: "4", label: "★★★★☆ (4)" },
  { value: "3", label: "★★★☆☆ (3)" },
  { value: "2", label: "★★☆☆☆ (2)" },
  { value: "1", label: "★☆☆☆☆ (1)" },
];

function Stars({ rating }) {
  if (!rating) return <span className="text-xs font-medium text-slate-400">No rating given</span>;
  return (
    <span className="text-sm text-saffron" aria-label={`${rating} out of 5 stars`}>
      {"★".repeat(rating)}
      <span className="text-slate-300">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

function formatDateTime(isoString) {
  if (!isoString) return "—";
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

export default function AdminPanditFeedbackPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [rating, setRating] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => setPage(1), [debouncedSearch, rating]);

  useEffect(() => {
    setLoading(true);
    listPanditFeedback({ search: debouncedSearch, rating, page, pageSize: PAGE_SIZE })
      .then((data) => {
        setItems(data?.items || []);
        setTotal(data?.total || 0);
      })
      .catch(() => {
        setItems([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [debouncedSearch, rating, page]);

  useEffect(() => {
    getPanditFeedbackSummary().then(setSummary).catch(() => setSummary(null));
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-maroon">Pandit Ji Feedback</h1>
        <p className="mt-1 text-sm text-slate-500">Feedback and concerns Pandit Ji have shared with the admin team, optionally tied to a specific booking.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Feedback</p>
          <p className="mt-2 text-2xl font-bold text-maroon">{summary?.total ?? "—"}</p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Average Rating</p>
          <p className="mt-2 text-2xl font-bold text-saffron">
            {summary?.average_rating != null ? `${summary.average_rating} / 5` : "—"}
            {summary?.rated_count ? <span className="ml-2 text-xs font-normal text-slate-400">({summary.rated_count} rated)</span> : null}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={rating}
          onChange={(event) => setRating(event.target.value)}
          title="Filter by rating"
          className="rounded-full border border-amber-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none focus:border-maroon"
        >
          {RATING_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by Pandit Ji name or feedback text"
          className="w-full rounded-full border border-amber-200 px-4 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100 sm:w-80"
        />
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading feedback...</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-amber-100 bg-white p-10 text-center text-sm text-slate-400">No feedback matches these filters.</div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-800">{item.pandit?.display_name || item.pandit?.name || "Pandit Ji"}</p>
                  <p className="text-xs text-slate-500">{item.pandit?.city || ""}</p>
                </div>
                <div className="text-right">
                  <Stars rating={item.rating} />
                  <p className="mt-1 text-xs text-slate-400">{formatDateTime(item.created_at)}</p>
                </div>
              </div>

              <p className="mt-3 text-sm text-slate-700">{item.comment}</p>

              <div className="mt-3 text-xs text-slate-500">
                {item.booking ? (
                  <span className="rounded-full bg-amber-50 px-3 py-1 font-semibold text-maroon">
                    Re: {item.booking.puja_title || "Puja"} — {item.booking.date || "date unknown"} {item.booking.timeslot ? `• ${item.booking.timeslot}` : ""}
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-50 px-3 py-1 font-semibold text-slate-500">General feedback</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
        <span>
          Showing {items.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}
          {" - "}
          {Math.min(page * PAGE_SIZE, total)} of {total} feedback item(s)
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
    </div>
  );
}
