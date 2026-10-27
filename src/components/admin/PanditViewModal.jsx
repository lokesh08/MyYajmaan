import { useEffect, useState } from "react";

import Modal from "../Modal";
import { getPanditDetail } from "../../services/adminApi";
import { panditPlaceholderImage } from "../../constants/visualAssets";

const AADHAR_STATUS_LABELS = {
  not_started: "Not started",
  otp_sent: "OTP sent, not yet verified",
  verified: "Verified",
  mismatch: "Mismatch found",
  skipped: "Skipped by admin",
};

export default function PanditViewModal({ panditId, open, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !panditId) return;
    setLoading(true);
    getPanditDetail(panditId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [open, panditId]);

  const pandit = detail?.pandit;
  const isFemale = (pandit?.gender || "").toLowerCase() === "female";

  return (
    <Modal open={open} onClose={onClose} title="Pandit Ji Details" size="lg">
      {loading && <p className="text-sm text-slate-500">Loading...</p>}

      {!loading && pandit && (
        <div className="space-y-5 text-sm">
          {isFemale && (
            <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50 px-4 py-2.5 text-sm font-semibold text-fuchsia-700">
              Female Pandit Ji -- the app currently targets male Pandit Ji only. Please review carefully.
            </div>
          )}

          <div className="flex items-center gap-4">
            <img
              src={pandit.avatar_url || panditPlaceholderImage}
              alt={pandit.display_name || pandit.name || "Pandit Ji"}
              className="h-20 w-20 rounded-full border border-amber-100 object-cover"
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = panditPlaceholderImage;
              }}
            />
            <div>
              <p className="font-serif text-lg font-semibold text-maroon">{pandit.display_name || pandit.name || "-"}</p>
              <p className="text-xs text-slate-500">{pandit.email || "-"}</p>
              <p className="text-xs text-slate-500">{pandit.phone || "-"}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs text-slate-400">Status</p>
              <p className="font-medium capitalize text-slate-700">{pandit.verification_status}</p>
            </div>
            {pandit.verification_status === "approved" && (
              <div>
                <p className="text-xs text-slate-400">Account</p>
                <p className={`font-medium ${pandit.account_disabled ? "text-rose-600" : "text-emerald-600"}`}>
                  {pandit.account_disabled ? "Disabled" : "Active"}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-400">Gender</p>
              <p className="font-medium capitalize text-slate-700">{pandit.gender || "Unknown"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">City / State</p>
              <p className="font-medium text-slate-700">{[pandit.city, pandit.state].filter(Boolean).join(", ") || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Experience</p>
              <p className="font-medium text-slate-700">
                {pandit.experience_years ? `${pandit.experience_years} Years` : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Total Bookings</p>
              <p className="font-medium text-slate-700">{detail.total_bookings}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Requested On</p>
              <p className="font-medium text-slate-700">
                {pandit.created_at ? new Date(pandit.created_at).toLocaleDateString() : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Address</p>
              <p className="font-medium text-slate-700">{pandit.address || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Price</p>
              <p className="font-medium text-slate-700">{pandit.price ? `Rs. ${pandit.price}` : "-"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Created via</p>
              <p className="font-medium text-slate-700">{pandit.created_by_admin_id ? "Admin bulk upload" : "Self-registration"}</p>
            </div>
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50/40 px-4 py-3">
            <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Aadhaar Verification</p>
            <p className="font-medium text-slate-700">
              {AADHAR_STATUS_LABELS[pandit.aadhar_verification_status] || "Not started"}
              {pandit.aadhar_masked && ` — ${pandit.aadhar_masked}`}
            </p>
          </div>

          {(pandit.languages_spoken?.length > 0 || pandit.specialities?.length > 0 || pandit.service_areas?.length > 0) && (
            <div className="grid gap-3 sm:grid-cols-3">
              {pandit.languages_spoken?.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold text-slate-500">Languages</p>
                  <div className="flex flex-wrap gap-1.5">
                    {pandit.languages_spoken.map((item) => (
                      <span key={item} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-slate-700">{item}</span>
                    ))}
                  </div>
                </div>
              )}
              {pandit.specialities?.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold text-slate-500">Specialities</p>
                  <div className="flex flex-wrap gap-1.5">
                    {pandit.specialities.map((item) => (
                      <span key={item} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-slate-700">{item}</span>
                    ))}
                  </div>
                </div>
              )}
              {pandit.service_areas?.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold text-slate-500">Service Areas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {pandit.service_areas.map((item) => (
                      <span key={item} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-slate-700">{item}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {(pandit.about || pandit.bio) && (
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-500">About</p>
              <p className="text-slate-600">{pandit.about || pandit.bio}</p>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-500">Pujas this Pandit Ji performs</p>
            {detail.pujas?.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {detail.pujas.map((puja) => (
                  <div key={puja.id} className="flex items-center justify-between rounded-lg border border-amber-100 px-3 py-2">
                    <span className="text-slate-700">{puja.title}</span>
                    <span className="font-semibold text-maroon">Rs. {Number(puja.price || 0).toFixed(0)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No pujas added yet.</p>
            )}
          </div>

          {detail.registration?.photo_url && (
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-500">Submitted passport photo</p>
              <img
                src={detail.registration.photo_url}
                alt="Submitted passport"
                className="h-32 w-32 rounded-lg border border-amber-100 object-cover"
              />
            </div>
          )}

          {pandit.rejection_reason && (
            <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
              <span className="font-semibold">Rejection reason: </span>
              {pandit.rejection_reason}
            </div>
          )}
        </div>
      )}

      {!loading && !pandit && <p className="text-sm text-slate-500">Pandit Ji details could not be loaded.</p>}
    </Modal>
  );
}
