import { useEffect, useState } from "react";

import Modal from "../Modal";
import { getUserDetail } from "../../services/adminApi";
import { formatRoleLabel } from "../../utils/roleLabels";

export default function UserViewModal({ userId, open, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);
    getUserDetail(userId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [open, userId]);

  return (
    <Modal open={open} onClose={onClose} title="User Details" size="md">
      {loading && <p className="text-sm text-slate-500">Loading...</p>}

      {!loading && detail?.user && (
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate-400">Full Name</p>
              <p className="font-medium text-slate-700">{detail.user.full_name || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Status</p>
              <p className="font-medium capitalize text-slate-700">{detail.user.status}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Email</p>
              <p className="font-medium text-slate-700">{detail.user.email || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Phone</p>
              <p className="font-medium text-slate-700">{detail.user.phone || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Role</p>
              <p className="font-medium text-slate-700">{formatRoleLabel(detail.user.role)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Total Bookings</p>
              <p className="font-medium text-slate-700">{detail.total_bookings}</p>
            </div>
          </div>

          {detail.flags?.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-500">Moderation history</p>
              <ul className="space-y-1">
                {detail.flags.map((flag) => (
                  <li key={flag.id} className="rounded-lg bg-amber-50 px-3 py-2 text-xs">
                    <span className="font-semibold capitalize">{flag.flag_type}</span> — {flag.reason}
                    <span className="ml-1 text-slate-400">({flag.is_active ? "active" : "cleared"})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!loading && !detail?.user && <p className="text-sm text-slate-500">User details could not be loaded.</p>}
    </Modal>
  );
}
