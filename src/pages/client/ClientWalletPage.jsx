import { useEffect, useState } from "react";
import useLiveRefresh from "../../hooks/useLiveRefresh";

import { useAuth } from "../../context/AuthContext";
import { getMyClientWallet, topupMyWallet } from "../../services/clientApi";
import { payWithRazorpay } from "../../services/razorpay";
import { showError, showSuccess } from "../../utils/toaster";
import Modal from "../../components/Modal";
import ThemeDialog from "../../components/ThemeDialog";

function AddMoneyModal({ open, onClose, onDone }) {
  const { profile } = useAuth();
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState({ open: false, title: "", message: "" });

  useEffect(() => {
    if (open) setAmount("");
  }, [open]);

  async function handleSubmit() {
    const value = Number(amount);
    if (!amount || value <= 0) {
      showError("Please enter a valid amount.");
      return;
    }
    setSaving(true);
    let paymentRef = null;
    try {
      // Same real Razorpay Checkout flow as paying for a puja -- the
      // backend only credits the wallet once it has verified an actual
      // payment for this exact amount (see routers/client_wallet.py).
      const verified = await payWithRazorpay({
        amount: value,
        description: "MyYajmaan wallet top-up",
        prefill: {
          name: profile?.full_name || undefined,
          email: profile?.email || undefined,
          contact: profile?.phone || undefined,
        },
      });
      paymentRef = verified.sessionId;
      await topupMyWallet(value, paymentRef);
      showSuccess("Money added to your wallet successfully.");
      onDone();
      onClose();
    } catch (error) {
      if (error?.isPaymentCancelled) {
        // Customer closed the Razorpay window without paying -- not a
        // failure worth showing an error for.
      } else if (paymentRef) {
        // Money was taken but crediting the wallet afterward failed --
        // retrying would risk paying twice, so this needs support, not
        // another attempt. Closes the Add Money modal itself so only
        // this dialog is on screen.
        onClose();
        setDialog({
          open: true,
          title: "Payment received",
          message: `Your payment (ref: ${paymentRef}) was received, but we could not add it to your wallet. Please do not pay again - contact support with this reference.`,
        });
      } else {
        showError(error?.data?.detail?.message || error?.message || "Could not add money to your wallet.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <Modal open={open} onClose={onClose} title="Add Money" size="sm">
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Amount (Rs.) *</span>
          <input
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 1000"
            className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
          />
        </label>
        <p className="text-xs text-slate-500">You'll be taken to Razorpay to pay securely via UPI, card or net banking.</p>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="interactive-button rounded-full border border-amber-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-amber-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="interactive-button rounded-full bg-maroon px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Processing..." : "Add Money"}
        </button>
      </div>
    </Modal>

    <ThemeDialog
      open={dialog.open}
      title={dialog.title}
      message={dialog.message}
      onClose={() => setDialog((prev) => ({ ...prev, open: false }))}
    />
    </>
  );
}

export default function ClientWalletPage() {
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addMoneyOpen, setAddMoneyOpen] = useState(false);

  function load({ silent = false } = {}) {
    if (!silent) setLoading(true);
    getMyClientWallet({ page: 1, pageSize: 20 })
      .then(setWallet)
      .catch(() => {
        if (!silent) showError("Could not load your wallet.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  // A refund/credit notification updates the balance on screen.
  useLiveRefresh(() => load({ silent: true }));

  if (loading || !wallet) {
    return <p className="py-10 text-center text-sm text-slate-400">Loading your wallet...</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-2xl font-semibold text-maroon">My Wallet</h1>

      <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-maroon to-maroon p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-amber-100/80">Wallet Balance</p>
            <p className="mt-2 font-serif text-3xl font-semibold">Rs. {Number(wallet.balance || 0).toFixed(2)}</p>
          </div>
          <button
            type="button"
            onClick={() => setAddMoneyOpen(true)}
            className="interactive-button rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-maroon hover:bg-amber-50"
          >
            + Add Money
          </button>
        </div>
      </div>

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

      <AddMoneyModal open={addMoneyOpen} onClose={() => setAddMoneyOpen(false)} onDone={load} />
    </div>
  );
}
