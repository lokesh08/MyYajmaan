import { useEffect, useState } from "react";

import {
  approvePandit,
  getPanditStatusCounts,
  listPandits,
  rejectPandit,
  skipPanditAadharVerification,
  updatePanditAccountStatus,
} from "../../services/adminApi";
import PanditsTable from "../../components/admin/PanditsTable";
import PanditViewModal from "../../components/admin/PanditViewModal";
import PanditRejectDialog from "../../components/admin/PanditRejectDialog";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import PanditBulkUploadModal from "../../components/admin/PanditBulkUploadModal";
import PanditResetPasswordModal from "../../components/admin/PanditResetPasswordModal";
import PanditAccountStatusDialog from "../../components/admin/PanditAccountStatusDialog";
import { showError, showSuccess } from "../../utils/toaster";

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

const PAGE_SIZE = 10;

export default function AdminPanditsPage() {
  const [tab, setTab] = useState("pending");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pandits, setPandits] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ all: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(false);
  const [viewPanditId, setViewPanditId] = useState(null);
  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [resetPasswordTarget, setResetPasswordTarget] = useState(null);
  const [skipAadharTarget, setSkipAadharTarget] = useState(null);
  const [accountStatusTarget, setAccountStatusTarget] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [tab, debouncedSearch]);

  useEffect(() => {
    setLoading(true);
    listPandits({ status: tab, search: debouncedSearch, page, pageSize: PAGE_SIZE })
      .then((data) => {
        setPandits(data?.items || []);
        setTotal(data?.total || 0);
      })
      .catch(() => {
        setPandits([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [tab, debouncedSearch, page, refreshKey]);

  useEffect(() => {
    getPanditStatusCounts(debouncedSearch).then(setCounts).catch(() => {});
  }, [debouncedSearch, refreshKey]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function handleChanged() {
    setRefreshKey((key) => key + 1);
  }

  async function handleApproveConfirm() {
    if (!approveTarget) return;
    setActionLoading(true);
    try {
      await approvePandit(approveTarget.id);
      showSuccess("Pandit Ji approved. They are now visible for booking.");
      setApproveTarget(null);
      handleChanged();
    } catch (error) {
      showError(error?.data?.detail?.message || error?.message || "Could not approve this Pandit Ji.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSkipAadharConfirm() {
    if (!skipAadharTarget) return;
    setActionLoading(true);
    try {
      await skipPanditAadharVerification(skipAadharTarget.id);
      showSuccess("Aadhaar verification skipped for this Pandit Ji.");
      setSkipAadharTarget(null);
      handleChanged();
    } catch (error) {
      showError(error?.data?.detail?.message || error?.message || "Could not skip Aadhaar verification.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAccountStatusConfirm(reason) {
    if (!accountStatusTarget) return;
    const nextStatus = accountStatusTarget.account_disabled ? "active" : "disabled";
    setActionLoading(true);
    try {
      await updatePanditAccountStatus(accountStatusTarget.id, nextStatus, reason);
      showSuccess(nextStatus === "disabled" ? "Account disabled." : "Account enabled.");
      setAccountStatusTarget(null);
      handleChanged();
    } catch (error) {
      showError(error?.data?.detail?.message || error?.message || "Could not update this account's status.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRejectConfirm(reason) {
    if (!rejectTarget) return;
    setActionLoading(true);
    try {
      await rejectPandit(rejectTarget.id, reason);
      showSuccess("Pandit Ji registration rejected.");
      setRejectTarget(null);
      handleChanged();
    } catch (error) {
      showError(error?.data?.detail?.message || error?.message || "Could not reject this Pandit Ji.");
    } finally {
      setActionLoading(false);
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
              {item.label} ({counts[item.key] ?? 0})
            </button>
          ))}
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or city"
            className="w-full rounded-full border border-amber-200 px-4 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100 sm:w-64"
          />
          <button
            type="button"
            onClick={() => setBulkUploadOpen(true)}
            title="Upload a spreadsheet of Pandit Ji accounts"
            className="interactive-button whitespace-nowrap rounded-full bg-maroon px-4 py-2 text-sm font-semibold text-white hover:bg-maroon"
          >
            Bulk upload
          </button>
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading Pandit Ji requests...</p>
      ) : (
        <PanditsTable
          pandits={pandits}
          onView={(pandit) => setViewPanditId(pandit.id)}
          onApprove={(pandit) => setApproveTarget(pandit)}
          onReject={(pandit) => setRejectTarget(pandit)}
          onResetPassword={(pandit) => setResetPasswordTarget(pandit)}
          onSkipAadhar={(pandit) => setSkipAadharTarget(pandit)}
          onToggleAccountStatus={(pandit) => setAccountStatusTarget(pandit)}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
        <span>
          Showing {pandits.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}
          {" - "}
          {Math.min(page * PAGE_SIZE, total)} of {total} Pandit Ji
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

      <PanditViewModal panditId={viewPanditId} open={Boolean(viewPanditId)} onClose={() => setViewPanditId(null)} />

      <ConfirmDialog
        open={Boolean(approveTarget)}
        title="Approve Pandit Ji"
        message={`${approveTarget?.display_name || approveTarget?.name || "This Pandit Ji"} will become visible to customers for booking.`}
        confirmLabel="Approve"
        confirmClassName="bg-emerald-600 hover:bg-emerald-700"
        loading={actionLoading}
        onConfirm={handleApproveConfirm}
        onClose={() => setApproveTarget(null)}
      />

      <PanditRejectDialog
        pandit={rejectTarget}
        open={Boolean(rejectTarget)}
        loading={actionLoading}
        onConfirm={handleRejectConfirm}
        onClose={() => setRejectTarget(null)}
      />

      <PanditBulkUploadModal
        open={bulkUploadOpen}
        onClose={() => setBulkUploadOpen(false)}
        onUploaded={handleChanged}
      />

      <PanditResetPasswordModal
        pandit={resetPasswordTarget}
        open={Boolean(resetPasswordTarget)}
        onClose={() => setResetPasswordTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(skipAadharTarget)}
        title="Skip Aadhaar verification"
        message={`${skipAadharTarget?.display_name || skipAadharTarget?.name || "This Pandit Ji"} will be able to skip straight to photo + bank details. Use this only when their Aadhaar isn't linked to a mobile number.`}
        confirmLabel="Skip Aadhaar"
        confirmClassName="bg-sky-600 hover:bg-sky-700"
        loading={actionLoading}
        onConfirm={handleSkipAadharConfirm}
        onClose={() => setSkipAadharTarget(null)}
      />

      <PanditAccountStatusDialog
        pandit={accountStatusTarget}
        action={accountStatusTarget?.account_disabled ? "active" : "disabled"}
        open={Boolean(accountStatusTarget)}
        loading={actionLoading}
        onConfirm={handleAccountStatusConfirm}
        onClose={() => setAccountStatusTarget(null)}
      />
    </div>
  );
}
