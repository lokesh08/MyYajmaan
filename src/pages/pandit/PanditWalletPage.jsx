import { useEffect, useState } from "react";
import useLiveRefresh from "../../hooks/useLiveRefresh";

import { usePanditPortal } from "../../context/PanditPortalContext";
import { getMyWallet, requestWithdrawal } from "../../services/panditApi";
import { showError, showSuccess } from "../../utils/toaster";
import LockedNotice from "../../components/pandit/LockedNotice";

const WITHDRAWAL_STATUS_STYLES = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-sky-50 text-sky-700",
  paid: "bg-emerald-50 text-emerald-700",
  rejected: "bg-rose-50 text-rose-600",
};

export default function PanditWalletPage() {
  const { stage, rejectionReason } = usePanditPortal();
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function load({ silent = false } = {}) {
    if (!silent) setLoading(true);
    getMyWallet({ page: 1, pageSize: 20 })
      .then(setWallet)
      .catch(() => {
        if (!silent) showError("Could not load your wallet.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (stage === "approved") load();
  }, [stage]);

  useLiveRefresh(() => {
    if (stage === "approved") load({ silent: true });
  });

  if (stage !== "approved") {
    return <LockedNotice stage={stage} rejectionReason={rejectionReason} />;
  }

  async function handleWithdraw() {
    const value = Number(amount);
    if (!amount || value <= 0) {
      showError("Please enter a valid amount.");
      return;
    }
    setSubmitting(true);
    try {
      await requestWithdrawal(value);
      showSuccess("Withdrawal request submitted. Admin will process it shortly.");
      setAmount("");
      load();
    } catch (error) {
      showError(error?.message || "Could not submit your withdrawal request.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !wallet) {
    return <p className="py-10 text-center text-sm text-slate-400">Loading your wallet...</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-2xl font-semibold text-maroon">My Wallet</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-maroon to-maroon p-6 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase text-amber-100/80">Wallet Balance</p>
          <p className="mt-2 font-serif text-3xl font-semibold">Rs. {Number(wallet.balance || 0).toFixed(2)}</p>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-white p-6 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Move to Bank Account</p>
          {!wallet.has_bank_details ? (
            <p className="text-sm text-amber-700">
              Please add your bank details under <span className="font-semibold">My Profile → Bank Details</span> before requesting a
              withdrawal.
            </p>
          ) : (
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount (Rs.)"
                className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
              />
              <button
                type="button"
                onClick={handleWithdraw}
                disabled={submitting}
                className="interactive-button shrink-0 rounded-xl bg-maroon px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "..." : "Withdraw"}
              </button>
            </div>
          )}
        </div>
      </div>

      {wallet.withdrawal_requests?.length > 0 && (
        <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-serif text-lg font-semibold text-maroon">Withdrawal Requests</h2>
          <div className="space-y-2">
            {wallet.withdrawal_requests.map((req) => (
              <div key={req.id} className="flex items-center justify-between rounded-xl border border-amber-50 bg-cream/40 px-4 py-2.5 text-sm">
                <span>Rs. {Number(req.amount).toFixed(2)}</span>
                <span className="text-xs text-slate-400">{new Date(req.requested_at).toLocaleDateString()}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${WITHDRAWAL_STATUS_STYLES[req.status] || "bg-slate-100 text-slate-500"}`}>
                  {req.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-amber-100 bg-white shadow-sm">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="bg-amber-50/60 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Balance After</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-50">
            {(wallet.transactions || []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                  No transactions yet.
                </td>
              </tr>
            ) : (
              wallet.transactions.map((txn) => (
                <tr key={txn.id}>
                  <td className="px-4 py-3 text-slate-500">{new Date(txn.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 capitalize text-slate-700">{(txn.reason || "").replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 capitalize">{txn.type}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${txn.type === "credit" ? "text-emerald-600" : "text-rose-500"}`}>
                    {txn.type === "credit" ? "+" : "-"}Rs. {Number(txn.amount).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">Rs. {Number(txn.balance_after || 0).toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
