import { useEffect, useState } from "react";

import Modal from "../Modal";
import { deleteReview, getReviewDetail, setReviewCoverPhoto, setReviewStatus } from "../../services/adminApi";
import { showError, showSuccess } from "../../utils/toaster";

const STATUS_OPTIONS = [
  { value: "published", label: "Publish", className: "bg-emerald-600 hover:bg-emerald-700" },
  { value: "pending", label: "Mark Pending", className: "bg-amber-500 hover:bg-amber-600" },
  { value: "hidden", label: "Hide", className: "bg-slate-500 hover:bg-slate-600" },
];

export default function TestimonialViewModal({ reviewId, open, onClose, onChanged }) {
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !reviewId) return;
    setLoading(true);
    getReviewDetail(reviewId)
      .then((data) => setReview(data?.review || null))
      .catch(() => setReview(null))
      .finally(() => setLoading(false));
  }, [open, reviewId]);

  async function handleStatus(status) {
    if (!review) return;
    setSaving(true);
    try {
      await setReviewStatus(review.id, status);
      showSuccess("Review status updated.");
      setReview((current) => ({ ...current, status }));
      onChanged?.();
    } catch (error) {
      showError(error?.data?.detail?.message || error?.data?.detail || error?.message || "Could not update this review.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSetCoverPhoto(index) {
    if (!review) return;
    setSaving(true);
    try {
      const result = await setReviewCoverPhoto(review.id, index);
      showSuccess("Cover photo updated. This is what shows on the home page.");
      setReview((current) => ({ ...current, cover_photo_url: result?.cover_photo_url }));
      onChanged?.();
    } catch (error) {
      showError(error?.data?.detail?.message || error?.data?.detail || error?.message || "Could not set this cover photo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!review) return;
    if (!window.confirm("Delete this testimonial permanently?")) return;
    setSaving(true);
    try {
      await deleteReview(review.id);
      showSuccess("Review deleted.");
      onChanged?.();
      onClose();
    } catch (error) {
      showError(error?.data?.detail?.message || error?.data?.detail || error?.message || "Could not delete this review.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Testimonial Details" size="md">
      {loading && <p className="text-sm text-slate-500">Loading...</p>}

      {!loading && review && (
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate-400">Customer</p>
              <p className="font-medium text-slate-700">{review.client_name || "Anonymous"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Status</p>
              <p className="font-medium capitalize text-slate-700">{review.status}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Puja</p>
              <p className="font-medium text-slate-700">{review.puja_title || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Rating</p>
              <p className="font-medium text-amber-500">{"★".repeat(review.rating || 0)}{"☆".repeat(5 - (review.rating || 0))}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-slate-400">Submitted On</p>
              <p className="font-medium text-slate-700">
                {review.created_at ? new Date(review.created_at).toLocaleString() : "-"}
              </p>
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold text-slate-500">Review</p>
            <p className="rounded-xl bg-amber-50 px-3 py-3 text-slate-700">{review.comment}</p>
          </div>

          {review.photo_urls?.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-slate-500">
                Photos -- click one to set it as the home page cover photo
              </p>
              <div className="grid grid-cols-3 gap-2">
                {review.photo_urls.map((url, index) => (
                  <button
                    key={url}
                    type="button"
                    disabled={saving}
                    onClick={() => handleSetCoverPhoto(index)}
                    title={url === review.cover_photo_url ? "Current cover photo" : "Set as cover photo"}
                    className={`relative overflow-hidden rounded-lg border-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                      url === review.cover_photo_url ? "border-maroon" : "border-transparent hover:border-amber-300"
                    }`}
                  >
                    <img src={url} alt="Feedback attachment" className="h-24 w-full object-cover" />
                    {url === review.cover_photo_url && (
                      <span className="absolute bottom-1 right-1 rounded-full bg-maroon px-2 py-0.5 text-[10px] font-bold text-white">
                        Cover
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Change Status</p>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={saving || review.status === option.value}
                  onClick={() => handleStatus(option.value)}
                  className={`interactive-button rounded-full px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 ${option.className}`}
                >
                  {option.label}
                </button>
              ))}
              <button
                type="button"
                disabled={saving}
                onClick={handleDelete}
                className="interactive-button rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && !review && <p className="text-sm text-slate-500">This review could not be loaded.</p>}
    </Modal>
  );
}
