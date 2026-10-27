import { useEffect, useState } from "react";

import Modal from "../Modal";
import ConfirmDialog from "./ConfirmDialog";
import {
  getComplaintDetailAdmin,
  replyToComplaint,
  resolveComplaint,
  updateComplaintStatus,
  updateUserStatus,
} from "../../services/adminApi";
import { showError, showSuccess } from "../../utils/toaster";

const STATUS_STYLES = { open: "bg-amber-100 text-amber-700", in_progress: "bg-sky-100 text-sky-700", resolved: "bg-emerald-100 text-emerald-700" };
const STATUS_LABELS = { open: "Not Viewed", in_progress: "In Progress", resolved: "Completed" };

function timeAgo(isoString) {
  if (!isoString) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ComplaintDetailModal({ complaintId, open, onClose, onChanged }) {
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [replying, setReplying] = useState(false);
  const [resolution, setResolution] = useState("valid");
  const [resolveMessage, setResolveMessage] = useState("");
  const [refundType, setRefundType] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [resolving, setResolving] = useState(false);
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [blocking, setBlocking] = useState(false);

  function load() {
    if (!complaintId) return;
    setLoading(true);
    getComplaintDetailAdmin(complaintId)
      .then((data) => setComplaint(data?.complaint || null))
      .catch(() => setComplaint(null))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!open || !complaintId) return;
    setReplyBody("");
    setResolveMessage("");
    setRefundType("");
    setRefundAmount("");
    setResolution("valid");
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, complaintId]);

  async function handleMoveInProgress() {
    try {
      await updateComplaintStatus(complaintId, "in_progress");
      showSuccess("Marked as In Progress.");
      load();
      onChanged?.();
    } catch (error) {
      showError(error?.data?.detail?.message || error?.message || "Could not update status.");
    }
  }

  async function handleReply() {
    if (!replyBody.trim()) return;
    setReplying(true);
    try {
      await replyToComplaint(complaintId, replyBody.trim());
      setReplyBody("");
      showSuccess("Reply sent.");
      load();
    } catch (error) {
      showError(error?.data?.detail?.message || error?.message || "Could not send reply.");
    } finally {
      setReplying(false);
    }
  }

  async function handleResolve() {
    if (resolution === "valid" && refundType && !refundAmount) {
      showError("Enter a refund amount.");
      return;
    }
    setResolving(true);
    try {
      await resolveComplaint(complaintId, {
        resolution,
        replyMessage: resolveMessage.trim() || undefined,
        refundType: resolution === "valid" ? refundType || undefined : undefined,
        refundAmount: resolution === "valid" && refundType ? Number(refundAmount) : undefined,
      });
      showSuccess("Complaint resolved.");
      load();
      onChanged?.();
    } catch (error) {
      showError(error?.data?.detail?.message || error?.message || "Could not resolve this complaint.");
    } finally {
      setResolving(false);
    }
  }

  async function handleBlockUser() {
    if (!complaint?.user?.id) return;
    if (!blockReason.trim()) {
      showError("A reason is required to block a user.");
      return;
    }
    setBlocking(true);
    try {
      await updateUserStatus(complaint.user.id, "blocked", blockReason.trim());
      showSuccess("User blocked.");
      setBlockConfirmOpen(false);
      setBlockReason("");
    } catch (error) {
      showError(error?.data?.detail?.message || error?.message || "Could not block this user.");
    } finally {
      setBlocking(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Complaint" size="lg">
      {loading && <p className="py-10 text-center text-sm text-slate-400">Loading...</p>}

      {!loading && !complaint && <p className="py-10 text-center text-sm text-slate-400">This complaint could not be loaded.</p>}

      {!loading && complaint && (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-serif text-lg font-semibold text-maroon">{complaint.subject}</p>
              <p className="text-xs text-slate-500">Raised {timeAgo(complaint.created_at)}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[complaint.status]}`}>{STATUS_LABELS[complaint.status]}</span>
          </div>

          <div className="grid gap-3 rounded-xl border border-amber-100 bg-amber-50/50 p-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-400">Yajmaan</p>
              <p className="font-medium text-slate-700">{complaint.user?.full_name}</p>
              <p className="text-xs text-slate-500">{complaint.user?.email} · {complaint.user?.phone}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Booking</p>
              <p className="font-medium text-slate-700">
                {complaint.booking?.booking_date} {complaint.booking?.muhurat_time_slot}
              </p>
              <p className="text-xs text-slate-500">Rs. {Number(complaint.booking?.amount || 0).toFixed(2)}</p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Thread</p>
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-amber-100 bg-white p-3">
              {(complaint.messages || []).map((msg) => (
                <div key={msg.id} className={`rounded-lg p-2.5 ${msg.sender_role === "admin" ? "bg-maroon/5" : "bg-amber-50"}`}>
                  <p className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-600">
                    <span>{msg.sender_role === "admin" ? "Admin" : complaint.user?.full_name || "Yajmaan"}</span>
                    <span className="font-normal text-slate-400">{timeAgo(msg.created_at)}</span>
                  </p>
                  <p className="mt-1 text-slate-700">{msg.body}</p>
                </div>
              ))}
            </div>
          </div>

          {complaint.status !== "resolved" && (
            <>
              <div className="flex gap-2">
                <input
                  value={replyBody}
                  onChange={(event) => setReplyBody(event.target.value)}
                  placeholder="Reply on this thread..."
                  className="flex-1 rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon"
                />
                <button
                  type="button"
                  onClick={handleReply}
                  disabled={replying || !replyBody.trim()}
                  className="interactive-button rounded-xl border border-amber-200 px-4 py-2 text-xs font-semibold text-maroon hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Reply
                </button>
              </div>

              {complaint.status === "open" && (
                <button
                  type="button"
                  onClick={handleMoveInProgress}
                  className="interactive-button rounded-full border border-sky-200 px-4 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-50"
                >
                  Mark as In Progress
                </button>
              )}

              <div className="rounded-xl border border-amber-100 bg-white p-3">
                <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Resolve this complaint</p>
                <div className="flex gap-2">
                  {[{ value: "valid", label: "User is right (valid)" }, { value: "invalid", label: "Not substantiated (invalid)" }].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setResolution(option.value)}
                      className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                        resolution === option.value ? "border-maroon bg-maroon text-white" : "border-amber-200 text-slate-600 hover:bg-amber-50"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={resolveMessage}
                  onChange={(event) => setResolveMessage(event.target.value)}
                  rows={2}
                  placeholder="Closing note for the Yajmaan (optional, posted to the thread)..."
                  className="mt-3 w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon"
                />

                {resolution === "valid" && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <select
                      value={refundType}
                      onChange={(event) => setRefundType(event.target.value)}
                      className="rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon"
                    >
                      <option value="">No refund</option>
                      <option value="full">Full refund</option>
                      <option value="partial">Partial refund</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={refundAmount}
                      onChange={(event) => setRefundAmount(event.target.value)}
                      disabled={!refundType}
                      placeholder="Refund amount (Rs.)"
                      className="rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon disabled:opacity-50"
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleResolve}
                  disabled={resolving}
                  className="interactive-button mt-3 w-full rounded-full bg-maroon px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resolving ? "Resolving..." : "Resolve Complaint"}
                </button>
              </div>

              {resolution === "invalid" && (
                <button
                  type="button"
                  onClick={() => setBlockConfirmOpen(true)}
                  className="interactive-button w-full rounded-full border border-rose-200 px-5 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                >
                  Block this user
                </button>
              )}
            </>
          )}

          {complaint.status === "resolved" && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-emerald-800">
              Resolved as <strong>{complaint.resolution}</strong>
              {complaint.refund_amount ? ` · Rs. ${Number(complaint.refund_amount).toFixed(2)} refunded (${complaint.refund_type})` : ""}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={blockConfirmOpen}
        title="Block this user?"
        message="This deactivates their account and prevents them from logging in until an admin reactivates it."
        confirmLabel={blocking ? "Blocking..." : "Block User"}
        confirmClassName="bg-rose-600 hover:bg-rose-700"
        loading={blocking}
        onConfirm={handleBlockUser}
        onClose={() => setBlockConfirmOpen(false)}
      >
        <textarea
          value={blockReason}
          onChange={(event) => setBlockReason(event.target.value)}
          rows={2}
          placeholder="Reason for blocking (required)"
          className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon"
        />
      </ConfirmDialog>
    </Modal>
  );
}
