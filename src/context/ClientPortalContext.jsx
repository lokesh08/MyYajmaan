import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { getMyProfile } from "../services/clientApi";

const ClientPortalContext = createContext(null);

/**
 * Fetches the customer's profile once and shares it across every
 * dashboard screen (sidebar greeting, profile-completeness checks)
 * so pages don't each re-fetch it independently.
 */
export function ClientPortalProvider({ children }) {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  const refetch = useCallback(() => {
    setState((current) => ({ ...current, loading: true }));
    return getMyProfile()
      .then((data) => {
        setState({ loading: false, error: null, data: data?.profile || null });
        return data?.profile;
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
      profile: state.data,
      refetch,
    }),
    [state, refetch],
  );

  return <ClientPortalContext.Provider value={value}>{children}</ClientPortalContext.Provider>;
}

export function useClientPortal() {
  const context = useContext(ClientPortalContext);
  if (!context) {
    throw new Error("useClientPortal must be used inside ClientPortalProvider");
  }
  return context;
}
