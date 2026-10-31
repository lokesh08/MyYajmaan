import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { PanditPortalProvider, usePanditPortal } from "../../context/PanditPortalContext";
import PanditSidebar from "./PanditSidebar";
import { t } from "../../i18n";

function StatusBanner() {
  const { stage, rejectionReason } = usePanditPortal();

  if (stage === "approved") return null;

  if (stage === "rejected") {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        <p className="font-semibold">{t("Your registration was declined.")}</p>
        {rejectionReason && <p className="mt-1">{rejectionReason}</p>}
        <p className="mt-1">
          {t("Head to")}{' '}<span className="font-semibold">{t("My Profile")}</span>{' '}{t("to review and re-submit your documents.")}
        </p>
      </div>
    );
  }

  if (stage === "pending") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <p className="font-semibold">{t("Your registration is under admin review.")}</p>
        <p className="mt-1">{t("Most sections unlock once your profile is approved.")}</p>
      </div>
    );
  }

  return null;
}

function LayoutBody({ children }) {
  const { loading, stage } = usePanditPortal();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-500">
        {t("Loading your Pandit Ji portal...")}
      </div>
    );
  }

  // Onboarding wizard hasn't been completed yet; only the /pandit
  // landing page knows how to render it.
  if (stage === "onboarding") {
    return <Navigate to="/pandit" replace />;
  }

  return (
    <div className="flex min-h-[calc(100vh-6rem)] bg-cream">
      <PanditSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3 border-b border-amber-100 bg-white px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen((current) => !current)}
            aria-label={t("Toggle menu")}
            className="interactive-button rounded-lg border border-amber-200 p-2 text-maroon"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
            </svg>
          </button>
          <p className="font-serif text-lg font-semibold text-maroon">{t("Pandit Ji Portal")}</p>
        </div>

        <main className="space-y-4 p-4 sm:p-6">
          <StatusBanner />
          {children}
        </main>
      </div>
    </div>
  );
}

export default function PanditDashboardLayout({ children }) {
  return (
    <PanditPortalProvider>
      <LayoutBody>{children}</LayoutBody>
    </PanditPortalProvider>
  );
}
