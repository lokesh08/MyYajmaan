// src/utils/sessionBroadcast.js
//
// Lets every open tab in this browser know which account is
// currently signed in. The backend already refuses to let a
// browser hold two active sessions (cookie storage handles that),
// but without this a second tab that was left open on the old
// account would only find out on its next API call. This makes
// the switch immediate and visible instead of a silent 401/403.

const SESSION_MARKER_KEY = "myyajmaan_session_marker";

export function broadcastSession(profile) {
  if (!profile) {
    clearSessionBroadcast();
    return;
  }

  try {
    localStorage.setItem(
      SESSION_MARKER_KEY,
      JSON.stringify({
        userId: profile.id,
        role: profile.role,
        ts: Date.now(),
      }),
    );
  } catch {
    // Storage unavailable (e.g. private browsing). Nothing to do.
  }
}

export function clearSessionBroadcast() {
  try {
    localStorage.removeItem(SESSION_MARKER_KEY);
  } catch {
    // Ignore.
  }
}

/**
 * Calls `onChange(marker)` whenever another tab in this browser
 * signs in or out. `marker` is `{ userId, role, ts }` or `null`
 * when the other tab signed out. Returns an unsubscribe function.
 */
export function subscribeToSessionChanges(onChange) {
  function handleStorage(event) {
    if (event.key !== SESSION_MARKER_KEY) {
      return;
    }

    let marker = null;

    try {
      marker = event.newValue
        ? JSON.parse(event.newValue)
        : null;
    } catch {
      marker = null;
    }

    onChange(marker);
  }

  window.addEventListener("storage", handleStorage);

  return () => window.removeEventListener("storage", handleStorage);
}
