const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
};

const AADHAR_STATUS_STYLES = {
  not_started: "bg-slate-100 text-slate-500",
  otp_sent: "bg-amber-100 text-amber-700",
  verified: "bg-emerald-100 text-emerald-700",
  mismatch: "bg-rose-100 text-rose-700",
  skipped: "bg-sky-100 text-sky-700",
};

const AADHAR_STATUS_LABELS = {
  not_started: "Aadhaar: not started",
  otp_sent: "Aadhaar: OTP sent",
  verified: "Aadhaar: verified",
  mismatch: "Aadhaar: mismatch",
  skipped: "Aadhaar: skipped",
};

export default function PanditsTable({ pandits = [], onView, onApprove, onReject, onResetPassword, onSkipAadhar, onToggleAccountStatus }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-amber-100 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-amber-100 text-xs uppercase text-slate-400">
          <tr>
            <th className="px-4 py-3 font-medium">Pandit Ji</th>
            <th className="px-4 py-3 font-medium">Phone</th>
            <th className="px-4 py-3 font-medium">City</th>
            <th className="px-4 py-3 font-medium">Experience</th>
            <th className="px-4 py-3 font-medium">Requested On</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-amber-50">
          {pandits.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                No Pandit Ji requests found.
              </td>
            </tr>
          )}
          {pandits.map((pandit) => {
            const name = pandit.display_name || pandit.name || "-";
            const isPending = pandit.verification_status === "pending";
            const isFemale = (pandit.gender || "").toLowerCase() === "female";
            const aadharStatus = pandit.aadhar_verification_status || "not_started";
            const canSkipAadhar = isPending && aadharStatus !== "verified" && aadharStatus !== "skipped";

            return (
              <tr key={pandit.id} className={isFemale ? "bg-fuchsia-50/70" : undefined}>
                <td className="px-4 py-3 font-medium text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <span>{name}</span>
                    {isFemale && (
                      <span
                        title="Female Pandit Ji -- flagged for special review since the app currently targets male Pandit Ji only."
                        className="rounded-full bg-fuchsia-100 px-2 py-0.5 text-[10px] font-bold uppercase text-fuchsia-700"
                      >
                        Female
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-normal text-slate-400">{pandit.email || "-"}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">{pandit.phone || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{[pandit.city, pandit.state].filter(Boolean).join(", ") || "-"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {pandit.experience_years ? `${pandit.experience_years} Years` : "-"}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {pandit.created_at ? new Date(pandit.created_at).toLocaleDateString() : "-"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                        STATUS_STYLES[pandit.verification_status] || "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {pandit.verification_status}
                    </span>
                    {pandit.verification_status === "approved" && pandit.is_active === false && !pandit.account_disabled && (
                      <span
                        title="Approved, but not yet visible to customers -- waiting for this Pandit Ji to log in with their temporary password and set a new one."
                        className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700"
                      >
                        Awaiting activation
                      </span>
                    )}
                    {pandit.account_disabled && (
                      <span
                        title="Disabled by admin -- this Pandit Ji cannot log in or take any action until re-enabled."
                        className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700"
                      >
                        Account Disabled
                      </span>
                    )}
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${AADHAR_STATUS_STYLES[aadharStatus]}`}>
                      {AADHAR_STATUS_LABELS[aadharStatus]}
                    </span>
                    {pandit.current_streak >= 3 && (
                      <span
                        title={`Declined the last ${pandit.current_streak} bookings in a row without accepting one -- may need a call to check in.`}
                        className="rounded-full bg-rose-600 px-2.5 py-1 text-xs font-bold text-white"
                      >
                        ⚠ {pandit.current_streak} declines in a row
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      aria-label={`View details for ${name}`}
                      onClick={() => onView(pandit)}
                      className="interactive-button rounded-lg border border-amber-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-amber-50"
                    >
                      View Details
                    </button>

                    {pandit.verification_status === "approved" && (
                      <button
                        type="button"
                        aria-label={`Reset password for ${name}`}
                        title="Generate a new temporary password to share with this Pandit Ji"
                        onClick={() => onResetPassword(pandit)}
                        className="interactive-button rounded-lg border border-amber-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-amber-50"
                      >
                        Reset Password
                      </button>
                    )}

                    {pandit.verification_status === "approved" && (
                      <button
                        type="button"
                        aria-label={pandit.account_disabled ? `Enable account for ${name}` : `Disable account for ${name}`}
                        title={
                          pandit.account_disabled
                            ? "Re-enable this Pandit Ji's account so they can log in again"
                            : "Block this Pandit Ji from logging in and sign them out of any active session"
                        }
                        onClick={() => onToggleAccountStatus(pandit)}
                        className={`interactive-button rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                          pandit.account_disabled
                            ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            : "border-rose-200 text-rose-700 hover:bg-rose-50"
                        }`}
                      >
                        {pandit.account_disabled ? "Enable Account" : "Disable Account"}
                      </button>
                    )}

                    {canSkipAadhar && (
                      <button
                        type="button"
                        aria-label={`Skip Aadhaar verification for ${name}`}
                        title="For a Pandit Ji whose Aadhaar isn't linked to a mobile number -- lets them skip straight to photo + bank details"
                        onClick={() => onSkipAadhar(pandit)}
                        className="interactive-button rounded-lg border border-sky-200 px-2.5 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-50"
                      >
                        Skip Aadhaar
                      </button>
                    )}

                    {isPending && (
                      <>
                        <button
                          type="button"
                          aria-label={`Approve ${name}`}
                          onClick={() => onApprove(pandit)}
                          className="interactive-button rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          aria-label={`Reject ${name}`}
                          onClick={() => onReject(pandit)}
                          className="interactive-button rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
