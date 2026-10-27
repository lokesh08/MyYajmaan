import { useEffect, useState } from "react";

import { getReviewStatusCounts, listReviews } from "../../services/adminApi";
import TestimonialsTable from "../../components/admin/TestimonialsTable";
import TestimonialViewModal from "../../components/admin/TestimonialViewModal";

const TABS = [
  { key: "all", label: "All Reviews" },
  { key: "published", label: "Published" },
  { key: "pending", label: "Pending" },
  { key: "hidden", label: "Hidden" },
];

const PAGE_SIZE = 10;

export default function AdminTestimonialsPage() {
  const [tab, setTab] = useState("all");
  const [page, setPage] = useState(1);
  const [reviews, setReviews] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ all: 0, published: 0, pending: 0, hidden: 0 });
  const [loading, setLoading] = useState(false);
  const [viewReviewId, setViewReviewId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setPage(1);
  }, [tab]);

  useEffect(() => {
    setLoading(true);
    listReviews({ status: tab, page, pageSize: PAGE_SIZE })
      .then((data) => {
        setReviews(data?.items || []);
        setTotal(data?.total || 0);
      })
      .catch(() => {
        setReviews([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [tab, page, refreshKey]);

  useEffect(() => {
    getReviewStatusCounts().then(setCounts).catch(() => {});
  }, [refreshKey]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function handleChanged() {
    setRefreshKey((key) => key + 1);
  }

  function handleStatusChanged(reviewId, status) {
    setReviews((current) => current.map((r) => (r.id === reviewId ? { ...r, status } : r)));
    handleChanged();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-xl font-semibold text-maroon">Feedback / Testimonials Management</h1>
          <p className="text-sm text-slate-500">
            Choose which reviews appear on the Home page (up to {20} at a time).
          </p>
        </div>
      </div>

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
            {item.label} ({counts[item.key] ?? 0})
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading testimonials...</p>
      ) : (
        <TestimonialsTable reviews={reviews} onView={(review) => setViewReviewId(review.id)} onStatusChanged={handleStatusChanged} />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
        <span>
          Showing {reviews.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}
          {" - "}
          {Math.min(page * PAGE_SIZE, total)} of {total} reviews
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

      <TestimonialViewModal
        reviewId={viewReviewId}
        open={Boolean(viewReviewId)}
        onClose={() => setViewReviewId(null)}
        onChanged={handleChanged}
      />
    </div>
  );
}
