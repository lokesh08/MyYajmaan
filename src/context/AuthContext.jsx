import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { get, post } from "../api";
import { ADMIN_BASE_PATH } from "../constants/adminRoutes";
import { IDLE_LOGOUT_MS } from "../config/appConfig";
import { showInfo } from "../utils/toaster";
import useIdleLogout, { clearLastActivity, markActivityNow } from "../hooks/useIdleLogout";
import { getLoginPathForRole } from "../utils/roleRoutes";
import {
  broadcastSession,
  clearSessionBroadcast,
  subscribeToSessionChanges,
} from "../utils/sessionBroadcast";
import { t } from "../i18n";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const profileRef = useRef(null);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  async function loadCurrentUser() {
    try {
      const result = await get("/auth/me");
      const user = result?.user || null;
      setProfile(user);
      broadcastSession(user);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  // Sets the signed-in profile and lets other open tabs in this
  // browser know, so they can react immediately (a single browser
  // can only ever hold one active account).
  function applyLogin(user) {
    markActivityNow();
    setProfile(user);
    broadcastSession(user);
  }

  async function logout() {
    try {
      await post("/auth/logout", {});
    } finally {
      setProfile(null);
      clearSessionBroadcast();
      clearLastActivity();
    }
  }

  // Signs out a customer / Pandit Ji session left untouched for
  // IDLE_LOGOUT_MS. (The admin portal has its own session check, so
  // AdminLayout wires the same hook for itself.)
  useIdleLogout(Boolean(profile), async () => {
    const destination = getLoginPathForRole(profileRef.current?.role);
    try {
      await logout();
    } catch {
      // Cookies may already be gone; the local state is cleared regardless.
    }
    showInfo(t("You were signed out after {v0} minutes of inactivity.", { v0: Math.round(IDLE_LOGOUT_MS / 60000) }));
    navigate(destination, { replace: true });
  });

  useEffect(() => {
    // The admin portal checks its own session via adminMe() in
    // AdminLayout, so the customer-facing /auth/me check is skipped
    // there. Every other route (including "/" and the login/register
    // pages) needs a real check on every navigation so the header nav
    // and guards like GuestOnlyRoute always reflect the true session,
    // including on a hard refresh/direct navigation.
    const isAdminPortal = location.pathname.startsWith(ADMIN_BASE_PATH);

    if (isAdminPortal) {
      setLoading(false);
      return;
    }

    loadCurrentUser();
  }, [location.pathname]);

  // Reacts when a different account signs in (or signs out) in
  // another tab of this same browser, since the backend only lets
  // one account be active per browser at a time.
  useEffect(() => {
    return subscribeToSessionChanges((marker) => {
      const currentProfile = profileRef.current;

      if (!currentProfile) {
        return;
      }

      if (marker && marker.userId === currentProfile.id) {
        return;
      }

      const destination = getLoginPathForRole(currentProfile.role);

      setProfile(null);

      showInfo(
        marker
          ? t("You were signed out because another account signed in on this browser.")
          : t("You were signed out in another tab."),
      );

      navigate(destination);
    });
  }, [navigate]);

  // Backend re-checks account status on every request, not just at
  // login (see auth.py's get_current_user) -- admin disabling/
  // blocking this account mid-session surfaces here the moment the
  // next API call fails, rather than only on the next full page load.
  //
  // Several requests can fail with this at once (e.g. this page's own
  // /auth/me plus a role-protected fetch), each dispatching the event
  // -- toastShownRef stops that from showing the toast more than once
  // per disablement. profileRef may already be null by the time this
  // runs (loadCurrentUser()'s own .catch() can race ahead of this),
  // so the role isn't always known here; RoleRoute falls back to the
  // URL prefix in that case, so navigate() doesn't have to get it
  // exactly right.
  const toastShownRef = useRef(false);
  useEffect(() => {
    function handleAccountDisabled(event) {
      // Prefer the still-known role if this handler wins the race
      // against loadCurrentUser()'s own unrelated .catch() (which can
      // clear profileRef first); fall back to the URL prefix, same
      // rule RoleRoute uses, when it's already gone.
      const knownRole = profileRef.current?.role;
      const destination = knownRole
        ? getLoginPathForRole(knownRole)
        : window.location.pathname.startsWith("/pandit")
          ? "/pandit/login"
          : "/login";
      setProfile(null);
      clearSessionBroadcast();

      if (!toastShownRef.current) {
        toastShownRef.current = true;
        showInfo(event.detail?.message || t("Your account is no longer active. Please contact support."));
        setTimeout(() => {
          toastShownRef.current = false;
        }, 3000);
      }

      navigate(destination);
    }

    window.addEventListener("myyajmaan:account-disabled", handleAccountDisabled);
    return () => window.removeEventListener("myyajmaan:account-disabled", handleAccountDisabled);
  }, [navigate]);

  const value = useMemo(
    () => ({
      profile,
      loading,
      isAuthenticated: Boolean(profile),
      role: profile?.role || null,
      userName:
        profile?.full_name ||
        profile?.email ||
        "User",
      setProfile,
      applyLogin,
      logout,
      reloadUser: loadCurrentUser,
    }),
    [profile, loading],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider",
    );
  }

  return context;
}