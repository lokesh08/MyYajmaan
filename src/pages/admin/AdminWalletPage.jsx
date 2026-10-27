import { useEffect, useState } from "react";

import {
  getWalletSummary,
  listBookingPayments,
  listWalletTransactionReasons,
  listWalletTransactions,
  listWithdrawalRequests,
  processWithdrawalRequest,
} from "../../services/adminApi";
import { showError, showSuccess } from "../../utils/toaster";
import StatCard from "../../components/admin/StatCard";
import ConfirmDialog from "../../components/admin/ConfirmDialog";

const PAGE_SIZE = 15;

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function RoleBadge({ role }) {
  const styles = {
    user: "bg-sky-50 text-sky-700",
    pandit: "bg-amber-50 text-amber-700",
    admin: "bg-slate-100 text-slate-600",
  };
  const labels = { user: "Yajmaan", pandit: "Pandit Ji", admin: "Admin" };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${styles[role] || "bg-slate-100 text-slate-500"}`}>
      {labels[role] || role || "—"}
    </span>
  );
}

function Pagination({ page, setPage, total, pageSize = PAGE_SIZE }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
      <span>
        Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((c) => Math.max(1, c - 1))}
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
          onClick={() => setPage((c) => Math.min(totalPages, c + 1))}
          className="interactive-button rounded-lg border border-amber-200 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

const filterInputClass =
  "w-full rounded-full border border-amber-200 px-4 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100";

// ---------------- Wallet Ledger tab ----------------

function WalletLedgerTab() {
  const [role, setRole] = useState("");
  const [type, setType] = useState("");
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [reasons, setReasons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listWalletTransactionReasons().then(setReasons).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => setPage(1), [role, type, reason, debouncedSearch]);

  useEffect(() => {
    setLoading(true);
    listWalletTransactions({ role, type, reason, search: debouncedSearch, page, pageSize: PAGE_SIZE })
      .then((data) => {
        setItems(data?.items || []);
        setTotal(data?.total || 0);
      })
      .catch(() => showError("Could not load wallet transactions."))
      .finally(() => setLoading(false));
  }, [role, type, reason, debouncedSearch, page]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email"
          className={`${filterInputClass} sm:w-64`}
        />
        <select value={role} onChange={(e) => setRole(e.target.value)} className={`${filterInputClass} sm:w-40`}>
          <option value="">All Roles</option>
          <option value="user">Yajmaan (Customer)</option>
          <option value="pandit">Pandit Ji</option>
          <option value="admin">Admin</option>
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className={`${filterInputClass} sm:w-36`}>
          <option value="">All Types</option>
          <option value="credit">Credit</option>
          <option value="debit">Debit</option>
        </select>
        <select value={reason} onChange={(e) => setReason(e.target.value)} className={`${filterInputClass} sm:w-52`}>
          <option value="">All Reasons</option>
          {reasons.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading transactions...</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-amber-100 bg-white p-8 text-center text-sm text-slate-400">No transactions found.</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-amber-100 bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-amber-50/60 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Balance After</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-50">
              {items.map((txn) => (
                <tr key={txn.id}>
                  <td className="px-4 py-3 text-slate-500">{formatDate(txn.created_at)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-700">{txn.user_name || "—"}</p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <RoleBadge role={txn.user_role} />
                      <span className="text-xs text-slate-400">{txn.user_email}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{txn.reason_label}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${txn.type === "credit" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                      {txn.type === "credit" ? "Credit" : "Debit"}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${txn.type === "credit" ? "text-emerald-600" : "text-rose-500"}`}>
                    {txn.type === "credit" ? "+" : "-"}
                    {formatCurrency(txn.amount)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">{formatCurrency(txn.balance_after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} setPage={setPage} total={total} />
    </div>
  );
}

// ---------------- Booking Payments tab ----------------

const BOOKING_STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "pending_pandit", label: "Awaiting Confirmation" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "declined", label: "Declined" },
];

function BookingStatusPill({ status }) {
  const styles = {
    pending_pandit: "bg-amber-50 text-amber-700",
    confirmed: "bg-sky-50 text-sky-700",
    completed: "bg-emerald-50 text-emerald-700",
    cancelled: "bg-slate-100 text-slate-500",
    declined: "bg-rose-50 text-rose-600",
  };
  const option = BOOKING_STATUS_OPTIONS.find((o) => o.value === status);
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status] || "bg-slate-100 text-slate-500"}`}>{option?.label || status}</span>;
}

function BookingPaymentsTab() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => setPage(1), [status, debouncedSearch]);

  useEffect(() => {
    setLoading(true);
    listBookingPayments({ status, search: debouncedSearch, page, pageSize: PAGE_SIZE })
      .then((data) => {
        setItems(data?.items || []);
        setTotal(data?.total || 0);
      })
      .catch(() => showError("Could not load booking payments."))
      .finally(() => setLoading(false));
  }, [status, debouncedSearch, page]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by customer, pandit, or payment ref"
          className={`${filterInputClass} sm:w-72`}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${filterInputClass} sm:w-48`}>
          {BOOKING_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading booking payments...</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-amber-100 bg-white p-8 text-center text-sm text-slate-400">No bookings found.</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-amber-100 bg-white shadow-sm">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-amber-50/60 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Pandit Ji</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Payment Ref</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Fee / Refund</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-50">
              {items.map((booking) => (
                <tr key={booking.id}>
                  <td className="px-4 py-3 text-slate-500">{booking.booking_date || booking.date || "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{booking.customer_name || "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{booking.pandit_name || "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-maroon">{formatCurrency(booking.amount)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{booking.payment_ref || "—"}</td>
                  <td className="px-4 py-3">
                    <BookingStatusPill status={booking.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {Number(booking.reschedule_fee_charged || 0) > 0 && <p>Reschedule fee: {formatCurrency(booking.reschedule_fee_charged)}</p>}
                    {Number(booking.cancellation_fee || 0) > 0 && <p>Cancellation fee: {formatCurrency(booking.cancellation_fee)}</p>}
                    {Number(booking.refund_amount || 0) > 0 && <p className="text-emerald-600">Refunded: {formatCurrency(booking.refund_amount)}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} setPage={setPage} total={total} />
    </div>
  );
}

// ---------------- Withdrawal Requests tab ----------------

const WITHDRAWAL_TABS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "paid", label: "Paid" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

function WithdrawalRequestsTab() {
  const [tab, setTab] = useState("pending");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionTarget, setActionTarget] = useState(null); // { request, action }
  const [notes, setNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => setPage(1), [tab]);

  useEffect(() => {
    setLoading(true);
    listWithdrawalRequests({ status: tab, page, pageSize: PAGE_SIZE })
      .then((data) => {
        setItems(data?.items || []);
        setTotal(data?.total || 0);
      })
      .catch(() => showError("Could not load withdrawal requests."))
      .finally(() => setLoading(false));
  }, [tab, page, refreshKey]);

  function openAction(request, action) {
    setActionTarget({ request, action });
    setNotes("");
  }

  async function handleConfirm() {
    if (!actionTarget) return;
    setActionLoading(true);
    try {
      const result = await processWithdrawalRequest(actionTarget.request.id, actionTarget.action, notes);
      showSuccess(result?.message || "Withdrawal request updated.");
      setActionTarget(null);
      setRefreshKey((k) => k + 1);
    } catch (error) {
      showError(error?.message || "Could not update this withdrawal request.");
    } finally {
      setActionLoading(false);
    }
  }

  const ACTION_LABELS = { approve: "Approve", reject: "Reject", mark_paid: "Mark as Paid" };
  const ACTION_COLORS = { approve: "bg-sky-600 hover:bg-sky-700", reject: "bg-rose-600 hover:bg-rose-700", mark_paid: "bg-emerald-600 hover:bg-emerald-700" };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-full border border-amber-100 bg-white p-1">
        {WITHDRAWAL_TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${tab === item.key ? "bg-maroon text-white" : "text-slate-600 hover:bg-amber-50"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading withdrawal requests...</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-amber-100 bg-white p-8 text-center text-sm text-slate-400">No {tab === "all" ? "" : tab} withdrawal requests.</div>
      ) : (
        <div className="grid gap-3">
          {items.map((req) => (
            <div key={req.id} className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-700">{req.pandit_name || "Pandit Ji"}</p>
                  <p className="text-xs text-slate-400">{req.pandit_city}</p>
                  <p className="mt-1 text-xs text-slate-400">Requested {formatDate(req.requested_at)}</p>
                </div>
                <div className="text-right">
                  <p className="font-serif text-xl font-semibold text-maroon">{formatCurrency(req.amount)}</p>
                  <span
                    className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                      req.status === "paid"
                        ? "bg-emerald-50 text-emerald-600"
                        : req.status === "rejected"
                          ? "bg-rose-50 text-rose-600"
                          : req.status === "approved"
                            ? "bg-sky-50 text-sky-700"
                            : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {req.status}
                  </span>
                </div>
              </div>

              {req.bank_details ? (
                <div className="mt-3 grid gap-1 rounded-xl bg-cream/60 p-3 text-xs text-slate-600 sm:grid-cols-2">
                  <p><span className="text-slate-400">Account Holder:</span> {req.bank_details.account_holder_name || "—"}</p>
                  <p><span className="text-slate-400">Bank:</span> {req.bank_details.bank_name || "—"}</p>
                  <p><span className="text-slate-400">Account No.:</span> {req.bank_details.account_number_masked || "—"}</p>
                  <p><span className="text-slate-400">IFSC:</span> {req.bank_details.ifsc_masked || "—"}</p>
                </div>
              ) : (
                <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-600">No bank details on file — cannot be paid until the pandit adds them.</p>
              )}

              {req.admin_notes && <p className="mt-2 text-xs italic text-slate-500">Note: {req.admin_notes}</p>}

              {(req.status === "pending" || req.status === "approved") && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {req.status === "pending" && (
                    <button
                      type="button"
                      onClick={() => openAction(req, "approve")}
                      className="interactive-button rounded-full border border-sky-200 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-50"
                    >
                      Approve
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!req.bank_details}
                    onClick={() => openAction(req, "mark_paid")}
                    title={!req.bank_details ? "Pandit has no bank details on file" : "Mark as paid"}
                    className="interactive-button rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Mark as Paid
                  </button>
                  <button
                    type="button"
                    onClick={() => openAction(req, "reject")}
                    className="interactive-button rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Pagination page={page} setPage={setPage} total={total} />

      <ConfirmDialog
        open={Boolean(actionTarget)}
        title={actionTarget ? `${ACTION_LABELS[actionTarget.action]} Withdrawal Request` : ""}
        message={
          actionTarget
            ? `${ACTION_LABELS[actionTarget.action]} the request for ${formatCurrency(actionTarget.request.amount)} from ${actionTarget.request.pandit_name || "this Pandit Ji"}?${
                actionTarget.action === "mark_paid" ? " This will deduct the amount from their wallet." : ""
              }`
            : ""
        }
        confirmLabel={actionTarget ? ACTION_LABELS[actionTarget.action] : "Confirm"}
        confirmClassName={actionTarget ? ACTION_COLORS[actionTarget.action] : undefined}
        loading={actionLoading}
        onConfirm={handleConfirm}
        onClose={() => setActionTarget(null)}
      >
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder={actionTarget?.action === "reject" ? "Reason for rejecting (required)" : "Notes (optional)"}
          className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
        />
      </ConfirmDialog>
    </div>
  );
}

// ---------------- Page ----------------

const TOP_TABS = [
  { key: "ledger", label: "Wallet Ledger" },
  { key: "bookings", label: "Booking Payments" },
  { key: "withdrawals", label: "Withdrawal Requests" },
];

export default function AdminWalletPage() {
  const [topTab, setTopTab] = useState("ledger");
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    getWalletSummary().then(setSummary).catch(() => {});
  }, [topTab]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-xl font-semibold text-maroon">Wallet & Transactions</h1>
        <p className="text-sm text-slate-500">Every wallet credit/debit, puja payment, and Pandit Ji payout in one place.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Yajmaan Wallets Total" value={formatCurrency(summary?.customer_wallet_total)} />
        <StatCard label="Pandit Ji Wallets Total" value={formatCurrency(summary?.pandit_wallet_total)} accent="saffron" />
        <StatCard label="Total Credited (all-time)" value={formatCurrency(summary?.total_credited)} accent="emerald" />
        <StatCard label="Total Debited (all-time)" value={formatCurrency(summary?.total_debited)} />
        <StatCard
          label="Pending Withdrawals"
          value={`${summary?.pending_withdrawal_count ?? 0} · ${formatCurrency(summary?.pending_withdrawal_amount)}`}
          accent="saffron"
        />
      </div>

      <div className="flex flex-wrap gap-2 rounded-full border border-amber-100 bg-white p-1">
        {TOP_TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTopTab(item.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${topTab === item.key ? "bg-maroon text-white" : "text-slate-600 hover:bg-amber-50"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {topTab === "ledger" && <WalletLedgerTab />}
      {topTab === "bookings" && <BookingPaymentsTab />}
      {topTab === "withdrawals" && <WithdrawalRequestsTab />}
    </div>
  );
}
