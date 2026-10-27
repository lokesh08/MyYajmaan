import { useEffect, useRef } from "react";

export const NOTIFICATION_EVENT = "myyajmaan:notification";

// A burst of notifications (e.g. one booking fanning out several
// messages) should trigger a single reload, not one per message.
const DEBOUNCE_MS = 400;

/**
 * Re-runs `reload` whenever a live notification arrives for the
 * signed-in user, so the screen shows the latest data without a
 * manual refresh (e.g. a dashboard flipping a puja to "Confirmed" the
 * moment the Pandit Ji confirms it).
 *
 * `reload` should refetch quietly -- keep the current content on
 * screen instead of flashing a loading state -- and must not reset
 * anything the person is in the middle of typing. Nothing is
 * remounted, so open dialogs and form fields are left untouched.
 */
export default function useLiveRefresh(reload) {
  const reloadRef = useRef(reload);

  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);

  useEffect(() => {
    let timer = null;

    function handleNotification() {
      clearTimeout(timer);
      timer = setTimeout(() => reloadRef.current?.(), DEBOUNCE_MS);
    }

    window.addEventListener(NOTIFICATION_EVENT, handleNotification);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(NOTIFICATION_EVENT, handleNotification);
    };
  }, []);
}
