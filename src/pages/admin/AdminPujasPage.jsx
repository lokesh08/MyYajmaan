import { useEffect, useState } from "react";

import { deletePuja, listAdminPujas } from "../../services/adminApi";
import PujasTable from "../../components/admin/PujasTable";
import PujaViewModal from "../../components/admin/PujaViewModal";
import PujaFormModal from "../../components/admin/PujaFormModal";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import { showError, showSuccess } from "../../utils/toaster";

const PAGE_SIZE = 10;

export default function AdminPujasPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pujas, setPujas] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [viewPujaId, setViewPujaId] = useState(null);
  const [formPuja, setFormPuja] = useState(undefined); // undefined = closed, null = add, object = edit
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
    listAdminPujas({ search: debouncedSearch, page, pageSize: PAGE_SIZE })
      .then((data) => {
        setPujas(data?.items || []);
        setTotal(data?.total || 0);
      })
      .catch(() => {
        setPujas([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [debouncedSearch, page, refreshKey]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function handleChanged() {
    setRefreshKey((key) => key + 1);
  }

  function handleStatusChanged(pujaId, isActive) {
    setPujas((current) => current.map((puja) => (puja.id === pujaId ? { ...puja, is_active: isActive } : puja)));
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePuja(deleteTarget.id);
      showSuccess("Puja deleted successfully.");
      setDeleteTarget(null);
      handleChanged();
    } catch (error) {
      showError(error?.data?.detail?.message || error?.data?.detail || error?.message || "Could not delete this puja.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by puja name or category"
          className="w-full rounded-full border border-amber-200 px-4 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100 sm:w-72"
        />

        <button
          type="button"
          onClick={() => setFormPuja(null)}
          className="interactive-button rounded-full bg-maroon px-5 py-2.5 text-sm font-semibold text-white hover:bg-maroon"
        >
          + Add Puja
        </button>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading pujas...</p>
      ) : (
        <PujasTable
          pujas={pujas}
          onView={(puja) => setViewPujaId(puja.id)}
          onEdit={(puja) => setFormPuja(puja)}
          onDelete={(puja) => setDeleteTarget(puja)}
          onStatusChanged={handleStatusChanged}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
        <span>
          Showing {pujas.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}
          {" - "}
          {Math.min(page * PAGE_SIZE, total)} of {total} pujas
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

      <PujaViewModal pujaId={viewPujaId} open={Boolean(viewPujaId)} onClose={() => setViewPujaId(null)} />

      <PujaFormModal
        puja={formPuja || null}
        open={formPuja !== undefined}
        onClose={() => setFormPuja(undefined)}
        onSaved={handleChanged}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Puja"
        message={`"${deleteTarget?.title}" will be permanently deleted. This can't be undone — consider disabling it instead if you might need it again.`}
        confirmLabel="Delete"
        confirmClassName="bg-rose-600 hover:bg-rose-700"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
