import axios from "axios";

let baseURL = "";

try {
  if (
    typeof import.meta !== "undefined" &&
    import.meta.env?.VITE_API_BASE_URL
  ) {
    baseURL = import.meta.env.VITE_API_BASE_URL;
  }
} catch {
  // Ignore non-Vite environments.
}

if (
  !baseURL &&
  typeof process !== "undefined" &&
  process.env?.REACT_APP_API_BASE
) {
  baseURL = process.env.REACT_APP_API_BASE;
}

const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    // CSRF defense-in-depth (see myyajmaan-api/security_middleware.py):
    // a cross-site <form> can't set a custom header, only same-origin
    // JS using this client can. Applies to every request through this
    // instance, postForm's multipart uploads included.
    "X-Requested-With": "XMLHttpRequest",
  },
});

// The access cookie only lives for an hour (Supabase's default), while
// the refresh cookie lasts 30 days -- but nothing ever exchanged one
// for the other, so every session silently ended an hour after login
// no matter how active the person was. Sessions are meant to end only
// on 30 minutes of inactivity (see useIdleLogout), so an expired
// access token is renewed here, once, and the failed request retried.
const SESSION_MARKER_KEY = "myyajmaan_session_marker";
let refreshInFlight = null;

function hasSignedInMarker() {
  try {
    return Boolean(localStorage.getItem(SESSION_MARKER_KEY));
  } catch {
    return false;
  }
}

function refreshSession() {
  // Concurrent 401s (a page firing several requests at once) share a
  // single refresh -- a refresh token is single-use, so racing several
  // would invalidate each other.
  if (!refreshInFlight) {
    refreshInFlight = api
      .post("/auth/refresh", {}, { skipAuthRefresh: true })
      .then(() => true)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (
      error?.code === "ERR_CANCELED" ||
      error?.message === "canceled"
    ) {
      return Promise.reject(error);
    }

    const original = error?.config;
    const expiredCode = error?.response?.data?.detail?.code;
    if (
      error?.response?.status === 401 &&
      original &&
      !original.skipAuthRefresh &&
      !original._retriedAfterRefresh &&
      (expiredCode === "SESSION_EXPIRED" || expiredCode === "NOT_AUTHENTICATED") &&
      // Login/register/refresh themselves must surface their own 401s,
      // and a guest (never signed in) has nothing to refresh.
      !/\/(auth\/(login|register|refresh|logout)|admin\/auth\/login)/.test(original.url || "") &&
      hasSignedInMarker()
    ) {
      original._retriedAfterRefresh = true;
      if (await refreshSession()) {
        return api(original);
      }
    }

    // The backend re-checks account status on every authenticated
    // request (not just at login), so a session an admin just
    // disabled/blocked can start failing mid-use, on whichever call
    // happens next. This dispatches a plain DOM event rather than
    // importing AuthContext/react-router here directly (this module
    // has no React context of its own) -- AuthContext and AdminLayout
    // each listen for it and handle clearing state + redirecting
    // themselves, the same decoupled pattern already used for the
    // cross-tab "signed out elsewhere" broadcast.
    const detail = error?.response?.data?.detail;
    if (error?.response?.status === 401 && detail?.code === "ACCOUNT_DISABLED") {
      window.dispatchEvent(
        new CustomEvent("myyajmaan:account-disabled", {
          detail: { message: detail.message },
        }),
      );
    }

    return Promise.reject(error);
  },
);

export default api;