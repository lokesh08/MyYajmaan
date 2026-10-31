import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { getPanditStatus } from "../services/panditApi";
import PanditOnboardingWizard from "../components/pandit/onboarding/PanditOnboardingWizard";
import LockedNotice from "../components/pandit/LockedNotice";
import { t } from "../i18n";

export default function PanditPage() {
  const [state, setState] = useState({ loading: true, stage: null, rejectionReason: null });

  const load = useCallback(() => {
    setState((current) => ({ ...current, loading: true }));
    getPanditStatus()
      .then((data) => {
        setState({ loading: false, stage: data?.stage || "onboarding", rejectionReason: data?.rejection_reason || null });
      })
      .catch(() => setState({ loading: false, stage: "onboarding", rejectionReason: null }));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (state.loading) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center px-6 py-10 lg:px-8">
        <p className="text-sm text-slate-500">{t("Loading your Pandit Ji profile...")}</p>
      </section>
    );
  }

  if (state.stage === "approved") {
    return <Navigate to="/pandit/dashboard" replace />;
  }

  if (state.stage === "onboarding") {
    return (
      <section className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
        <h1 className="mb-6 text-center font-serif text-3xl font-semibold text-maroon">{t("Complete Your Pandit Ji Registration")}</h1>
        <PanditOnboardingWizard onCompleted={load} />
      </section>
    );
  }

  // pending / rejected
  return (
    <section className="mx-auto max-w-3xl px-6 py-10 lg:px-8">
      <LockedNotice stage={state.stage} rejectionReason={state.rejectionReason} />
    </section>
  );
}
