import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { getPanditStatus } from "../services/panditApi";

const PanditPortalContext = createContext(null);

/**
 * Fetches the Pandit Ji's onboarding/verification status once and
 * shares it with every screen inside the portal, so each page can
 * decide whether to show its real content or a locked/pending state
 * without re-fetching status itself.
 */
export function PanditPortalProvider({ children }) {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  const refetch = useCallback(() => {
    setState((current) => ({ ...current, loading: true }));
    return getPanditStatus()
      .then((data) => {
        setState({ loading: false, error: null, data });
        return data;
      })
      .catch((error) => {
        setState({ loading: false, error, data: null });
        throw error;
      });
  }, []);

  useEffect(() => {
    refetch().catch(() => {});
  }, [refetch]);

  const value = useMemo(
    () => ({
      loading: state.loading,
      error: state.error,
      stage: state.data?.stage || null,
      panditId: state.data?.pandit_id || null,
      displayName: state.data?.display_name || null,
      rejectionReason: state.data?.rejection_reason || null,
      isApproved: state.data?.stage === "approved",
      refetch,
    }),
    [state, refetch],
  );

  return <PanditPortalContext.Provider value={value}>{children}</PanditPortalContext.Provider>;
}

export function usePanditPortal() {
  const context = useContext(PanditPortalContext);
  if (!context) {
    throw new Error("usePanditPortal must be used inside PanditPortalProvider");
  }
  return context;
}
