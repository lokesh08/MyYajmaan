import { useEffect, useState } from "react";

import { deleteMuhurat, listMuhrats } from "../../services/adminApi";
import MuhuratFormModal from "../../components/admin/MuhuratFormModal";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import { showError, showSuccess } from "../../utils/toaster";

const PAGE_SIZE = 10;

function formatWindow(startAt, endAt) {
  if (!startAt) return "-";
  const start = new Date(startAt);
  const end = endAt ? new Date(endAt) : null;
  const dateLabel = start.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  const startTime = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const endTime = end ? end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : null;
  return endTime ? `${dateLabel} • ${startTime} – ${endTime}` : `${dateLabel} • ${startTime}`;
}

function muhuratStatus(muhrat) {
  const now = new Date();
  const start = muhrat.start_at ? new Date(muhrat.start_at) : null;
  const end = muhrat.end_at ? new Date(muhrat.end_at) : null;
  if (!muhrat.active) return { label: "Inactive", className: "bg-slate-100 text-slate-600" };
  if (start && start > now) return { label: "Scheduled", className: "bg-sky-100 text-sky-700" };
  if (end && end < now) return { label: "Ended", className: "bg-slate-100 text-slate-500" };
  return { label: "Active", className: "bg-emerald-100 text-emerald-700" };
}

export default function AdminMuhuratPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [muhrats, setMuhrats] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formMuhrat, setFormMuhrat] = useState(undefined); // undefined = closed, null = add, object = edit
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    setLoading(true);
    listMuhrats({ search: debouncedSearch, page, pageSize: PAGE_SIZE })
      .then((data) => {
        setMuhrats(data?.items || []);
        setTotal(data?.total || 0);
      })
      .catch(() => {
        setMuhrats([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [debouncedSearch, page, refreshKey]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function handleChanged() {
    setRefreshKey((key) => key + 1);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMuhurat(deleteTarget.id);
      showSuccess("Shubh Muhurat deleted successfully.");
      setDeleteTarget(null);
      handleChanged();
    } catch (error) {
      showError(error?.data?.detail?.message || error?.data?.detail || error?.message || "Could not delete this Shubh Muhurat.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-xl font-semibold text-maroon">Shubh Muhurat</h1>
          <p className="text-sm text-slate-500">Create special time slots with offers</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title"
            className="w-full rounded-full border border-amber-200 px-4 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100 sm:w-64"
          />
          <button
            type="button"
            onClick={() => setFormMuhrat(null)}
            className="interactive-button rounded-full bg-maroon px-5 py-2.5 text-sm font-semibold text-white hover:bg-maroon"
          >
            + Add Muhurat
          </button>
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading Shubh Muhurat...</p>
      ) : (
        <div className="space-y-3">
          {muhrats.length === 0 && (
            <p className="rounded-2xl border border-amber-100 bg-white px-4 py-8 text-center text-sm text-slate-400">
              No Shubh Muhurat found.
            </p>
          )}

          {muhrats.map((muhrat) => {
            const status = muhuratStatus(muhrat);
            const pujaCount = (muhrat.puja_discounts || []).length;

            return (
              <div
                key={muhrat.id}
                className="flex flex-wrap items-center gap-4 rounded-2xl border border-amber-100 bg-white p-4 shadow-sm"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-lg">
                  🗓️
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-700">{muhrat.title}</p>
                  <p className="text-sm text-slate-500">{formatWindow(muhrat.start_at, muhrat.end_at)}</p>
                  <p className="text-xs text-saffron">
                    {pujaCount > 0
                      ? `${pujaCount} puja${pujaCount > 1 ? "s" : ""} with special discount`
                      : muhrat.discount_percent
                        ? `${muhrat.discount_percent}% off on all pujas`
                        : "No discount configured"}
                  </p>
                </div>

                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span>

                <div className="flex gap-2">
                  <button
                    type="button"
                    aria-label={`Edit ${muhrat.title}`}
                    onClick={() => setFormMuhrat(muhrat)}
                    className="interactive-button rounded-lg border border-maroon/30 px-2.5 py-1.5 text-xs font-semibold text-maroon hover:bg-maroon/10"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${muhrat.title}`}
                    onClick={() => setDeleteTarget(muhrat)}
                    className="interactive-button rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
        <span>
          Showing {muhrats.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}
          {" - "}
          {Math.min(page * PAGE_SIZE, total)} of {total} Shubh Muhurat
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

      <MuhuratFormModal
        muhrat={formMuhrat || null}
        open={formMuhrat !== undefined}
        onClose={() => setFormMuhrat(undefined)}
        onSaved={handleChanged}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Shubh Muhurat"
        message={`"${deleteTarget?.title}" will be permanently deleted.`}
        confirmLabel="Delete"
        confirmClassName="bg-rose-600 hover:bg-rose-700"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
