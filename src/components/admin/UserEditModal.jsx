import { useState } from "react";

import Modal from "../Modal";
import { updateUserStatus } from "../../services/adminApi";
import { showError, showSuccess } from "../../utils/toaster";

const STATUS_OPTIONS = ["active", "inactive", "blocked"];

export default function UserEditModal({ user, open, onClose, onUpdated }) {
  const [status, setStatus] = useState(user?.status || "active");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  async function handleSave() {
    if (status === "blocked" && !reason.trim()) {
      showError("Please provide a reason to block this user.");
      return;
    }

    setSaving(true);
    try {
      await updateUserStatus(user.id, status, reason.trim() || undefined);
      showSuccess("User status updated successfully.");
      onUpdated?.();
      onClose();
    } catch (error) {
      showError(error?.data?.detail?.message || error?.message || "Could not update user status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Edit ${user.full_name || "User"}`} size="sm">
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Account status</p>
          <div className="flex gap-2">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setStatus(option)}
                className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold capitalize transition ${
                  status === option ? "border-maroon bg-maroon text-white" : "border-amber-200 text-slate-600 hover:bg-amber-50"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {status === "blocked" && (
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500" htmlFor="block-reason">
              Reason (required)
            </label>
            <textarea
              id="block-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
              placeholder="Why is this account being blocked?"
            />
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="interactive-button w-full rounded-full bg-maroon px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </Modal>
  );
}
