import { useState } from "react";

import ConfirmDialog from "./ConfirmDialog";

/**
 * Confirms disabling (with a required reason) or re-enabling an
 * already-approved Pandit Ji's account. Disabling blocks any future
 * login and ends their current session immediately -- see
 * auth.py's get_current_user(), which re-checks account status on
 * every request, not just at login.
 */
export default function PanditAccountStatusDialog({ pandit, action, open, onClose, onConfirm, loading }) {
  const [reason, setReason] = useState("");

  function handleClose() {
    setReason("");
    onClose();
  }

  function handleConfirm() {
    onConfirm(reason.trim());
    setReason("");
  }

  const name = pandit?.display_name || pandit?.name || "this Pandit Ji";
  const isDisabling = action === "disabled";

  return (
    <ConfirmDialog
      open={open}
      title={isDisabling ? "Disable Pandit Ji account" : "Enable Pandit Ji account"}
      message={
        isDisabling
          ? `${name} will not be able to log in, and any session they currently have open will be ended immediately. They'll also be removed from the public booking catalog.`
          : `${name} will be able to log in again and will reappear in the public booking catalog.`
      }
      confirmLabel={isDisabling ? "Disable Account" : "Enable Account"}
      confirmClassName={isDisabling ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"}
      loading={loading}
      onConfirm={handleConfirm}
      onClose={handleClose}
    >
      {isDisabling && (
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-slate-500" htmlFor="pandit-disable-reason">
            Reason (required, shown to the Pandit Ji)
          </label>
          <textarea
            id="pandit-disable-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
            placeholder="e.g. Multiple customer complaints under review."
          />
        </div>
      )}
    </ConfirmDialog>
  );
}
