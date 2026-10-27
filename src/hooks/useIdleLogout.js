import { useEffect, useRef } from "react";

import { IDLE_LOGOUT_MS } from "../config/appConfig";

const LAST_ACTIVITY_KEY = "myyajmaan_last_activity";

// Keyboard, mouse and touch only -- the things a real person does.
const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "touchmove",
  "wheel",
];

// Activity fires constantly (every mouse-move); persisting it that
// often would hammer localStorage for no benefit, so writes are
// throttled. The check interval is what bounds the logout accuracy.
const WRITE_THROTTLE_MS = 5000;
const CHECK_INTERVAL_MS = 15000;

function readLastActivity() {
  try {
    const value = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeLastActivity(timestamp) {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(timestamp));
  } catch {
    // Storage unavailable (private browsing) -- the in-memory value
    // below still drives the timer for this tab.
  }
}

// A fresh sign-in starts a fresh window -- without this, a timestamp
// left behind by an earlier session that ended some other way (token
// expiry, disabled account) would sign the new session straight out.
export function markActivityNow() {
  writeLastActivity(Date.now());
}

export function clearLastActivity() {
  try {
    localStorage.removeItem(LAST_ACTIVITY_KEY);
  } catch {
    // Ignore.
  }
}

/**
 * Calls `onIdle` once after IDLE_LOGOUT_MS with no keyboard, mouse or
 * touch activity while `enabled` is true.
 *
 * The last-activity time lives in localStorage, so it is shared
 * across tabs (activity in any tab keeps every tab signed in) and
 * survives a closed tab -- someone who closes the tab and comes back
 * after the window has passed is signed out on load instead of
 * getting a fresh 30 minutes.
 */
export default function useIdleLogout(enabled, onIdle) {
  const onIdleRef = useRef(onIdle);

  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    if (!enabled) return undefined;

    let lastWrite = 0;
    let fired = false;
    let lastActivity = Date.now();

    // A stored timestamp older than the window means this browser was
    // idle while closed. Anything newer just continues from there.
    const stored = readLastActivity();
    if (stored) lastActivity = stored;

    function checkIdle() {
      if (fired) return;
      // Another tab may have recorded more recent activity.
      const shared = readLastActivity();
      const latest = Math.max(lastActivity, shared || 0);
      if (Date.now() - latest >= IDLE_LOGOUT_MS) {
        fired = true;
        clearLastActivity();
        onIdleRef.current?.();
      }
    }

    function handleActivity() {
      const now = Date.now();
      lastActivity = now;
      if (now - lastWrite >= WRITE_THROTTLE_MS) {
        lastWrite = now;
        writeLastActivity(now);
      }
    }

    // Timers are throttled/paused in background tabs and while a laptop
    // sleeps, so re-check the moment the tab is visible/focused again.
    function handleVisibility() {
      if (document.visibilityState === "visible") checkIdle();
    }

    // Evaluate before recording anything, so a stale timestamp is
    // honoured instead of being overwritten by the first render.
    checkIdle();
    if (fired) return undefined;

    lastWrite = Date.now();
    writeLastActivity(lastActivity);

    ACTIVITY_EVENTS.forEach((name) =>
      window.addEventListener(name, handleActivity, { passive: true }),
    );
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", checkIdle);
    const interval = setInterval(checkIdle, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((name) =>
        window.removeEventListener(name, handleActivity),
      );
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", checkIdle);
      clearInterval(interval);
    };
  }, [enabled]);
}
