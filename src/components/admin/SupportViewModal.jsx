import { useEffect, useState } from "react";

import Modal from "../Modal";
import { getSupportDetail, updateSupportRequest } from "../../services/adminApi";
import { showError, showSuccess } from "../../utils/toaster";

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
];

export default function SupportViewModal({ messageId, open, onClose, onChanged }) {
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("new");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open || !messageId) return;
    setLoading(true);
    getSupportDetail(messageId)
      .then((data) => {
        setRequest(data?.message || null);
        setStatus(data?.message?.status || "new");
        setNotes(data?.message?.admin_notes || "");
      })
      .catch(() => setRequest(null))
      .finally(() => setLoading(false));
  }, [open, messageId]);

  async function handleSave() {
    if (!request) return;
    setSaving(true);
    try {
      await updateSupportRequest(request.id, status, notes);
      showSuccess("Support request updated.");
      onChanged?.();
      onClose();
    } catch (error) {
      showError(error?.data?.detail?.message || error?.data?.detail || error?.message || "Could not update this request.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Support Request" size="md">
      {loading && <p className="text-sm text-slate-500">Loading...</p>}

      {!loading && request && (
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate-400">Name</p>
              <p className="font-medium text-slate-700">{request.first_name} {request.last_name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Submitted</p>
              <p className="font-medium text-slate-700">
                {request.created_at ? new Date(request.created_at).toLocaleString() : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Email</p>
              <p className="font-medium text-slate-700">{request.email}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Phone</p>
              <p className="font-medium text-slate-700">{request.phone}</p>
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold text-slate-500">Message</p>
            <p className="rounded-xl bg-amber-50 px-3 py-3 text-slate-700">{request.message}</p>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Status</p>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatus(option.value)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    status === option.value ? "border-maroon bg-maroon text-white" : "border-amber-200 text-slate-600 hover:bg-amber-50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500" htmlFor="support-notes">
              Admin Notes (internal)
            </label>
            <textarea
              id="support-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
              placeholder="Notes about how this was handled..."
            />
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="interactive-button w-full rounded-full bg-maroon px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      )}

      {!loading && !request && <p className="text-sm text-slate-500">This request could not be loaded.</p>}
    </Modal>
  );
}
