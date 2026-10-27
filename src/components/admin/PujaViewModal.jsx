import { useEffect, useState } from "react";

import Modal from "../Modal";
import { getAdminPujaDetail } from "../../services/adminApi";

export default function PujaViewModal({ pujaId, open, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !pujaId) return;
    setLoading(true);
    getAdminPujaDetail(pujaId)
      .then((data) => setDetail(data?.puja || null))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [open, pujaId]);

  const benefits = detail?.metadata?.benefits || [];

  return (
    <Modal open={open} onClose={onClose} title="Puja Details" size="md">
      {loading && <p className="text-sm text-slate-500">Loading...</p>}

      {!loading && detail && (
        <div className="space-y-4 text-sm">
          {(detail.image_url || detail.thumbnail_url) && (
            <img
              src={detail.image_url || detail.thumbnail_url}
              alt={detail.title}
              className="h-48 w-full rounded-xl object-cover"
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate-400">Puja Name</p>
              <p className="font-medium text-slate-700">{detail.title}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Status</p>
              <p className="font-medium text-slate-700">{detail.is_active ? "Active" : "Disabled"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Category</p>
              <p className="font-medium capitalize text-slate-700">{detail.category || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Listing Type</p>
              <p className="font-medium capitalize text-slate-700">{detail.listing_type || "normal"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Duration</p>
              <p className="font-medium text-slate-700">
                {detail.duration_minutes ? `${detail.duration_minutes} mins` : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Base Price</p>
              <p className="font-medium text-slate-700">{detail.base_price ? `₹${detail.base_price}` : "-"}</p>
            </div>
          </div>

          {detail.description && (
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-500">Description</p>
              <p className="text-slate-600">{detail.description}</p>
            </div>
          )}

          {benefits.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-500">Benefits</p>
              <div className="flex flex-wrap gap-1.5">
                {benefits.map((item) => (
                  <span key={item} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-slate-700">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && !detail && <p className="text-sm text-slate-500">Puja details could not be loaded.</p>}
    </Modal>
  );
}
