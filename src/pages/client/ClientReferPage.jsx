import { useEffect, useState } from "react";

import ReferralShare from "../../components/ReferralShare";
import { getReferralSummary } from "../../services/clientApi";
import { showError } from "../../utils/toaster";
import { t } from "../../i18n";
import "../../components/modals.css";

// Same layout/classes as the home page's Refer & Earn popup
// (components/ReferEarnModal.jsx) -- reused here as a full page instead
// of a modal, backed by the same GET /referral endpoint.
export default function ClientReferPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getReferralSummary()
      .then(setData)
      .catch(() => showError(t("Could not load your referral details.")))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return <p className="py-10 text-center text-sm text-slate-400">{t("Loading...")}</p>;
  }

  const signupReward = data.signupReward ?? "₹25";
  const bookingReward = data.bookingReward ?? "₹51";
  const earnings = data.earnings ?? "₹0.00";
  const totalEarned = data.totalEarned ?? "₹0.00";

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-2xl font-semibold text-maroon">{t("Refer & Earn")}</h1>

      <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm sm:p-6">
        <p className="mb-4 text-center text-sm text-slate-500">{t("Invite your friends and earn exciting rewards!")}</p>

        <div className="refer-grid">
          <div className="reward-card">
            <div className="reward-amount">{signupReward}</div>
            <div className="reward-sub">{t("You earn when your friend signs up")}</div>
          </div>
          <div className="reward-card">
            <div className="reward-amount">{bookingReward}</div>
            <div className="reward-sub">{t("You earn when your friend completes first puja booking")}</div>
          </div>
        </div>

        <ReferralShare code={data.code} />

        <div className="earnings-row">
          <div className="earn-col">
            <div className="earn-label">{t("Your Earnings")}</div>
            <div className="earn-value">{earnings}</div>
          </div>
          <div className="earn-col">
            <div className="earn-label">{t("Total Earned")}</div>
            <div className="earn-value green">{totalEarned}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
