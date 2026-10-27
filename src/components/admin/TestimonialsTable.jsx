import { setReviewStatus } from "../../services/adminApi";
import { showError } from "../../utils/toaster";

const STATUS_STYLES = {
  published: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  hidden: "bg-slate-100 text-slate-600",
};

function initials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function TestimonialsTable({ reviews = [], onView, onStatusChanged }) {
  async function handleTogglePublish(review) {
    const nextStatus = review.status === "published" ? "hidden" : "published";
    try {
      await setReviewStatus(review.id, nextStatus);
      onStatusChanged?.(review.id, nextStatus);
    } catch (error) {
      showError(error?.data?.detail?.message || error?.data?.detail || error?.message || "Could not update this review.");
    }
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-amber-100 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-amber-100 text-xs uppercase text-slate-400">
          <tr>
            <th className="px-4 py-3 font-medium">Reviewer</th>
            <th className="px-4 py-3 font-medium">Rating</th>
            <th className="px-4 py-3 font-medium">Review</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-amber-50">
          {reviews.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                No testimonials found.
              </td>
            </tr>
          )}
          {reviews.map((review) => (
            <tr key={review.id}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-saffron to-sand text-xs font-semibold text-maroon">
                    {initials(review.client_name)}
                  </div>
                  <div>
                    <p className="font-medium text-slate-700">{review.client_name || "Anonymous"}</p>
                    <p className="text-xs text-slate-400">
                      {review.puja_title || "Puja booking"} · {review.created_at ? new Date(review.created_at).toLocaleDateString() : "-"}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-amber-500">
                {"★".repeat(review.rating || 0)}
                {"☆".repeat(5 - (review.rating || 0))}
                <span className="ml-1 text-xs text-slate-500">{review.rating?.toFixed?.(1) ?? review.rating}</span>
              </td>
              <td className="max-w-xs px-4 py-3 text-slate-600">
                <p className="truncate">{review.comment}</p>
                {review.photo_urls?.length > 0 && (
                  <span className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-maroon">
                    📷 {review.photo_urls.length}
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[review.status]}`}>
                    {review.status}
                  </span>
                  {review.status !== "pending" && (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={review.status === "published"}
                      aria-label="Toggle published"
                      onClick={() => handleTogglePublish(review)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
                        review.status === "published" ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition ${
                          review.status === "published" ? "translate-x-5" : "translate-x-1"
                        }`}
                      />
                    </button>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    aria-label="View review"
                    onClick={() => onView(review)}
                    className="interactive-button rounded-lg border border-amber-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-amber-50"
                  >
                    View
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
