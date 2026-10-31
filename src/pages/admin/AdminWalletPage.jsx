import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  getWalletSummary,
  listBookingPayments,
  listPanditEarnings,
  listWalletTransactionReasons,
  listWalletTransactions,
  listWithdrawalRequests,
  processWithdrawalRequest,
  releasePanditEarning,
  revealWithdrawalBankDetails,
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

// ---------------- Pandit Ji Earnings tab ----------------
// Completed pujas whose Pandit Ji fee is released to their wallet by
// admin; the Pandit Ji then requests a withdrawal to their bank.

const EARNING_TABS = [
  { key: "pending", label: "To Release" },
  { key: "released", label: "Released" },
  { key: "all", label: "All" },
];

function PanditEarningsTab() {
  const [tab, setTab] = useState("pending");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState(null);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => setPage(1), [tab]);

  useEffect(() => {
    setLoading(true);
    listPanditEarnings({ status: tab, page, pageSize: PAGE_SIZE })
      .then((data) => {
        setItems(data?.items || []);
        setTotal(data?.total || 0);
      })
      .catch(() => showError("Could not load Pandit Ji earnings."))
      .finally(() => setLoading(false));
  }, [tab, page, refreshKey]);

  function openRelease(booking) {
    setTarget(booking);
    setAmount(Number(booking.pandit_fee_amount || 0) > 0 ? String(Number(booking.pandit_fee_amount)) : "");
    setNotes("");
  }

  async function handleRelease() {
    if (!target) return;
    const value = Number(amount);
    if (!amount || value <= 0) {
      showError("Please enter the amount to pay this Pandit Ji.");
      return;
    }
    setActionLoading(true);
    try {
      const result = await releasePanditEarning(target.id, { amount: value, adminNotes: notes.trim() });
      showSuccess(result?.message || "Fee added to the Pandit Ji's wallet.");
      setTarget(null);
      setRefreshKey((k) => k + 1);
    } catch (error) {
      showError(error?.message || "Could not release this fee.");
    } finally {
      setActionLoading(false);
    }
  }

  const fee = Number(target?.pandit_fee_amount || 0);
  const isPartial = target && fee > 0 && Number(amount) > 0 && Number(amount) < fee;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-full border border-amber-100 bg-white p-1">
        {EARNING_TABS.map((item) => (
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
        <p className="py-10 text-center text-sm text-slate-400">Loading Pandit Ji earnings...</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-amber-100 bg-white p-8 text-center text-sm text-slate-400">
          {tab === "pending" ? "No completed pujas waiting for a Pandit Ji payout." : "No released earnings yet."}
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((booking) => (
            <div key={booking.id} className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-700">{booking.pandit_name || "Pandit Ji"}</p>
                  <p className="text-xs text-slate-400">{booking.pandit_city}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {booking.puja_title} · {booking.customer_name || "Customer"}
                  </p>
                  <p className="text-xs text-slate-400">
                    Puja date {booking.booking_date || booking.date || "—"} · Booking {String(booking.id).slice(0, 8)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Pandit Ji fee</p>
                  <p className="font-serif text-xl font-semibold text-maroon">{formatCurrency(booking.pandit_fee_amount)}</p>
                  <p className="text-xs text-slate-400">Customer paid {formatCurrency(booking.amount)}</p>
                </div>
              </div>

              {booking.has_open_complaint && (
                <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-600">
                  This booking has an open complaint. Settle it under Complaints before releasing the fee.
                </p>
              )}
              {Number(booking.refund_amount || 0) > 0 && (
                <p className="mt-2 text-xs text-amber-700">Customer was refunded {formatCurrency(booking.refund_amount)} on this booking.</p>
              )}

              {booking.pandit_payout_released_at ? (
                <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700">
                  {formatCurrency(booking.pandit_payout_amount)} added to wallet on {formatDate(booking.pandit_payout_released_at)}
                </p>
              ) : (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => openRelease(booking)}
                    className="interactive-button min-h-[40px] rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    Pay to Pandit Ji Wallet
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Pagination page={page} setPage={setPage} total={total} />

      <ConfirmDialog
        open={Boolean(target)}
        title="Pay to Pandit Ji Wallet"
        message={
          target
            ? `Add this puja's fee to ${target.pandit_name || "the Pandit Ji"}'s wallet? They can then move it to their bank account. This can't be undone from here.`
            : ""
        }
        confirmLabel="Add to Wallet"
        confirmClassName="bg-emerald-600 hover:bg-emerald-700"
        loading={actionLoading}
        onConfirm={handleRelease}
        onClose={() => setTarget(null)}
      >
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-500">
            Amount (Rs.)
            <input
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-xl border border-amber-200 px-3 py-2 text-sm font-normal text-slate-700 outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
            />
          </label>
          {fee <= 0 && target && <p className="text-xs text-amber-700">No fee was recorded for this older booking — enter the amount to pay.</p>}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder={isPartial ? "Reason for paying less than the full fee (required)" : "Note for Pandit Ji (optional)"}
            className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
          />
        </div>
      </ConfirmDialog>
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
  const [payoutReference, setPayoutReference] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [fullBank, setFullBank] = useState({}); // request id -> unmasked details
  const [revealingId, setRevealingId] = useState(null);

  useEffect(() => setPage(1), [tab]);

  async function revealBank(request) {
    setRevealingId(request.id);
    try {
      const details = await revealWithdrawalBankDetails(request.id);
      setFullBank((current) => ({ ...current, [request.id]: details }));
    } catch (error) {
      showError(error?.message || "Could not load the bank details.");
    } finally {
      setRevealingId(null);
    }
  }

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
    setPayoutReference("");
    setPayoutMethod("");
  }

  async function handleConfirm() {
    if (!actionTarget) return;
    if (actionTarget.action === "mark_paid" && (payoutReference.trim().length < 4 || !payoutMethod)) {
      showError("Please enter the transaction reference (UTR) and payment method of the bank transfer.");
      return;
    }
    setActionLoading(true);
    try {
      const result = await processWithdrawalRequest(actionTarget.request.id, actionTarget.action, notes, {
        payoutReference: payoutReference.trim(),
        payoutMethod,
      });
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
                <div className="mt-3 rounded-xl bg-cream/60 p-3 text-xs text-slate-600">
                  <div className="grid gap-1 sm:grid-cols-2">
                    <p><span className="text-slate-400">Account Holder:</span> {fullBank[req.id]?.account_holder_name || req.bank_details.account_holder_name || "—"}</p>
                    <p><span className="text-slate-400">Bank:</span> {fullBank[req.id]?.bank_name || req.bank_details.bank_name || "—"}</p>
                    <p className="break-all">
                      <span className="text-slate-400">Account No.:</span>{" "}
                      <span className={fullBank[req.id] ? "font-mono font-semibold text-slate-800" : ""}>
                        {fullBank[req.id]?.account_number || req.bank_details.account_number_masked || "—"}
                      </span>
                    </p>
                    <p>
                      <span className="text-slate-400">IFSC:</span>{" "}
                      <span className={fullBank[req.id] ? "font-mono font-semibold text-slate-800" : ""}>
                        {fullBank[req.id]?.ifsc || req.bank_details.ifsc_masked || "—"}
                      </span>
                    </p>
                    {fullBank[req.id]?.upi_id && (
                      <p className="break-all">
                        <span className="text-slate-400">UPI ID:</span> <span className="font-mono font-semibold text-slate-800">{fullBank[req.id].upi_id}</span>
                      </p>
                    )}
                  </div>
                  {(req.status === "pending" || req.status === "approved") && !fullBank[req.id] && (
                    <button
                      type="button"
                      onClick={() => revealBank(req)}
                      disabled={revealingId === req.id}
                      className="mt-2 font-semibold text-maroon underline-offset-2 hover:underline disabled:opacity-60"
                    >
                      {revealingId === req.id ? "Loading..." : "Show full bank details to make the transfer"}
                    </button>
                  )}
                </div>
              ) : (
                <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-600">No bank details on file — cannot be paid until the pandit adds them.</p>
              )}

              {req.payout_reference && (
                <p className="mt-2 text-xs text-emerald-700">
                  Paid via {(req.payout_method || "").toUpperCase()} · Ref <span className="font-mono">{req.payout_reference}</span>
                  {req.processed_at ? ` · ${formatDate(req.processed_at)}` : ""}
                </p>
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
                actionTarget.action === "mark_paid"
                  ? " First transfer the money to their bank account, then enter the transfer details below. This will deduct the amount from their wallet."
                  : ""
              }`
            : ""
        }
        confirmLabel={actionTarget ? ACTION_LABELS[actionTarget.action] : "Confirm"}
        confirmClassName={actionTarget ? ACTION_COLORS[actionTarget.action] : undefined}
        loading={actionLoading}
        onConfirm={handleConfirm}
        onClose={() => setActionTarget(null)}
      >
        {actionTarget?.action === "mark_paid" && (
          <div className="mb-2 grid gap-2 sm:grid-cols-[1fr_9rem]">
            <input
              value={payoutReference}
              onChange={(e) => setPayoutReference(e.target.value)}
              maxLength={100}
              placeholder="Transaction ref / UTR (required)"
              aria-label="Transaction reference or UTR"
              className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
            />
            <select
              value={payoutMethod}
              onChange={(e) => setPayoutMethod(e.target.value)}
              aria-label="Payment method"
              className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
            >
              <option value="">Method</option>
              <option value="imps">IMPS</option>
              <option value="neft">NEFT</option>
              <option value="rtgs">RTGS</option>
              <option value="upi">UPI</option>
              <option value="other">Other</option>
            </select>
          </div>
        )}
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
  { key: "earnings", label: "Pandit Ji Earnings" },
  { key: "withdrawals", label: "Withdrawal Requests" },
];

export default function AdminWalletPage() {
  // ?tab= lets notifications open the right tab directly.
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [topTab, setTopTab] = useState(TOP_TABS.some((t) => t.key === requestedTab) ? requestedTab : "ledger");
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (TOP_TABS.some((t) => t.key === requestedTab)) setTopTab(requestedTab);
  }, [requestedTab]);

  useEffect(() => {
    getWalletSummary().then(setSummary).catch(() => {});
  }, [topTab]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-xl font-semibold text-maroon">Wallet & Transactions</h1>
        <p className="text-sm text-slate-500">Every wallet credit/debit, puja payment, and Pandit Ji payout in one place.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Yajmaan Wallets Total" value={formatCurrency(summary?.customer_wallet_total)} />
        <StatCard label="Pandit Ji Wallets Total" value={formatCurrency(summary?.pandit_wallet_total)} accent="saffron" />
        <StatCard label="Total Credited (all-time)" value={formatCurrency(summary?.total_credited)} accent="emerald" />
        <StatCard label="Total Debited (all-time)" value={formatCurrency(summary?.total_debited)} />
        <StatCard
          label="Pending Withdrawals"
          value={`${summary?.pending_withdrawal_count ?? 0} · ${formatCurrency(summary?.pending_withdrawal_amount)}`}
          accent="saffron"
        />
        <StatCard
          label="Pandit Ji Fees to Release"
          value={`${summary?.unreleased_earning_count ?? 0} · ${formatCurrency(summary?.unreleased_earning_amount)}`}
          accent="emerald"
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
      {topTab === "earnings" && <PanditEarningsTab />}
      {topTab === "withdrawals" && <WithdrawalRequestsTab />}
    </div>
  );
}
