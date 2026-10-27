import { useState } from "react";

import Modal from "../Modal";
import ConfirmDialog from "./ConfirmDialog";
import { resetPanditPassword } from "../../services/adminApi";
import { showError, showSuccess } from "../../utils/toaster";

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt("Copy this value", text);
    return false;
  }
}

/**
 * Two-step flow: confirm, then (on success) show the generated
 * temporary password exactly once for admin to copy and share with
 * the Pandit Ji directly -- the backend never shows it again.
 */
export default function PanditResetPasswordModal({ pandit, open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const name = pandit?.display_name || pandit?.name || "this Pandit Ji";

  function handleClose() {
    setResult(null);
    onClose();
  }

  async function handleConfirm() {
    if (!pandit) return;
    setLoading(true);
    try {
      const data = await resetPanditPassword(pandit.id);
      setResult(data);
    } catch (error) {
      showError(error?.data?.detail?.message || error?.message || "Could not reset this Pandit Ji's password.");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <Modal open={open} onClose={handleClose} title="Password reset" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Share this temporary password with <strong>{name}</strong> directly. It will not be shown again, and
            they'll be asked to set their own password the next time they log in.
          </p>
          <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <span className="font-mono text-sm text-slate-800">{result.temporary_password}</span>
            <button
              type="button"
              onClick={() => copyText(result.temporary_password).then(() => showSuccess("Copied."))}
              className="interactive-button rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-amber-50"
            >
              Copy
            </button>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="interactive-button rounded-full bg-maroon px-4 py-2 text-sm font-semibold text-white hover:bg-maroon"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <ConfirmDialog
      open={open}
      title="Reset password"
      message={`This generates a new temporary password for ${name}. Their next login will require them to set a new password before they can use the app.`}
      confirmLabel="Reset password"
      confirmClassName="bg-maroon hover:bg-maroon"
      loading={loading}
      onConfirm={handleConfirm}
      onClose={handleClose}
    />
  );
}
