import { useState } from "react";

import ConfirmDialog from "./ConfirmDialog";

export default function PanditRejectDialog({ pandit, open, onClose, onConfirm, loading }) {
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

  return (
    <ConfirmDialog
      open={open}
      title="Reject Pandit Ji registration"
      message={`${name}'s request will be hidden from the booking app. They can still log in and re-upload documents for another review.`}
      confirmLabel="Reject"
      confirmClassName="bg-rose-600 hover:bg-rose-700"
      loading={loading}
      onConfirm={handleConfirm}
      onClose={handleClose}
    >
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase text-slate-500" htmlFor="pandit-reject-reason">
          Reason (optional, shown to the Pandit Ji)
        </label>
        <textarea
          id="pandit-reject-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
          placeholder="e.g. Certificate image is unreadable, please re-upload."
        />
      </div>
    </ConfirmDialog>
  );
}
