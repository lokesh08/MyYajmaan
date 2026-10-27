import { useEffect, useState } from "react";

import { deleteCoupon, listCoupons } from "../../services/adminApi";
import CouponsTable from "../../components/admin/CouponsTable";
import CouponFormModal from "../../components/admin/CouponFormModal";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import { showError, showSuccess } from "../../utils/toaster";

const TABS = [
  { key: "general", label: "All Coupons" },
  { key: "referral", label: "Referral Coupons" },
];

const PAGE_SIZE = 10;

export default function AdminCouponsPage() {
  const [tab, setTab] = useState("general");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [coupons, setCoupons] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formCoupon, setFormCoupon] = useState(undefined); // undefined = closed, null = add, object = edit
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [tab, debouncedSearch]);

  useEffect(() => {
    setLoading(true);
    listCoupons({ type: tab, search: debouncedSearch, page, pageSize: PAGE_SIZE })
      .then((data) => {
        setCoupons(data?.items || []);
        setTotal(data?.total || 0);
      })
      .catch(() => {
        setCoupons([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [tab, debouncedSearch, page, refreshKey]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function handleChanged() {
    setRefreshKey((key) => key + 1);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCoupon(deleteTarget.id);
      showSuccess("Coupon deleted successfully.");
      setDeleteTarget(null);
      handleChanged();
    } catch (error) {
      showError(error?.data?.detail?.message || error?.data?.detail || error?.message || "Could not delete this coupon.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by code or description"
            className="w-full rounded-full border border-amber-200 px-4 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100 sm:w-64"
          />
          <button
            type="button"
            onClick={() => setFormCoupon(null)}
            className="interactive-button rounded-full bg-maroon px-5 py-2.5 text-sm font-semibold text-white hover:bg-maroon"
          >
            + Add {tab === "referral" ? "Reward" : "Coupon"}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading coupons...</p>
      ) : (
        <CouponsTable coupons={coupons} onEdit={(coupon) => setFormCoupon(coupon)} onDelete={(coupon) => setDeleteTarget(coupon)} />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
        <span>
          Showing {coupons.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}
          {" - "}
          {Math.min(page * PAGE_SIZE, total)} of {total} coupons
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

      <CouponFormModal
        coupon={formCoupon || null}
        tab={tab}
        open={formCoupon !== undefined}
        onClose={() => setFormCoupon(undefined)}
        onSaved={handleChanged}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Coupon"
        message={`"${deleteTarget?.code}" will be permanently deleted. Coupons that have already been used by customers can't be deleted — deactivate them instead.`}
        confirmLabel="Delete"
        confirmClassName="bg-rose-600 hover:bg-rose-700"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
