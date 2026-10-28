import { useCallback, useEffect, useRef, useState } from "react";

import {
  getNotificationsSocketUrl,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notificationsApi";
import { NOTIFICATION_EVENT } from "./useLiveRefresh";

// Reconnects almost immediately after a real disconnect, backing off
// only if it keeps failing (so a genuinely-down server doesn't get
// hammered with a tight retry loop). Resets back to the fast delay
// once a connection actually succeeds.
const RECONNECT_START_DELAY_MS = 500;
const RECONNECT_MAX_DELAY_MS = 15000;

// Closing a still-CONNECTING WebSocket immediately logs "WebSocket is
// closed before the connection is established" -- harmless, but
// avoidable. This happens on every mount in dev because React 18's
// StrictMode deliberately mounts effects, cleans them up, then mounts
// them again, so the very first socket this hook ever opens gets
// asked to close before its handshake finishes. Waiting for it to
// finish opening before closing it sidesteps the warning entirely
// (StrictMode's double-invoke only happens in development -- a
// production build never does this in the first place).
function closeSafely(socket) {
  if (!socket) return;
  if (socket.readyState === WebSocket.CONNECTING) {
    socket.addEventListener("open", () => socket.close(), { once: true });
  } else {
    socket.close();
  }
}

/**
 * Self-contained: doesn't assume any particular auth mechanism (the
 * customer/Pandit Ji header uses AuthContext, the admin topbar uses
 * its own adminMe() check) -- it just tries to fetch/connect, and
 * fails quietly if unauthenticated. The caller decides whether to
 * even render a bell based on its own knowledge of the session;
 * `enabled` lets it skip connecting entirely until then.
 */
export default function useNotifications(enabled) {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const mountedRef = useRef(true);

  const loadFirstPage = useCallback(() => {
    setLoading(true);
    listNotifications({ limit: 6 })
      .then((data) => {
        if (!mountedRef.current) return;
        setItems(data?.items || []);
        setHasMore(Boolean(data?.has_more));
      })
      .catch(() => {})
      .finally(() => mountedRef.current && setLoading(false));
  }, []);

  const loadMore = useCallback(() => {
    if (loading || !hasMore || items.length === 0) return;
    setLoading(true);
    listNotifications({ offset: items.length, limit: 6 })
      .then((data) => {
        if (!mountedRef.current) return;
        setItems((current) => [...current, ...(data?.items || [])]);
        setHasMore(Boolean(data?.has_more));
      })
      .catch(() => {})
      .finally(() => mountedRef.current && setLoading(false));
  }, [loading, hasMore, items]);

  const markRead = useCallback((id) => {
    setItems((current) => current.filter((item) => item.id !== id));
    setUnreadCount((current) => Math.max(0, current - 1));
    markNotificationRead(id).catch(() => {});
  }, []);

  const markAllRead = useCallback(() => {
    setItems([]);
    setUnreadCount(0);
    setHasMore(false);
    markAllNotificationsRead().catch(() => {});
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) return undefined;

    getUnreadNotificationCount()
      .then((data) => mountedRef.current && setUnreadCount(data?.count || 0))
      .catch(() => {});
    loadFirstPage();

    let stopped = false;
    let reconnectDelay = RECONNECT_START_DELAY_MS;

    async function connect() {
      if (stopped) return;
      let socket;
      try {
        const url = await getNotificationsSocketUrl();
        if (stopped) return;
        socket = new WebSocket(url);
      } catch {
        reconnectTimerRef.current = setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_DELAY_MS);
        return;
      }
      socketRef.current = socket;

      socket.onopen = () => {
        // A connection that actually succeeds means whatever caused
        // the last failure (if any) is over -- the next disconnect
        // should retry fast again, not continue from an escalated
        // backoff left over from a past outage.
        reconnectDelay = RECONNECT_START_DELAY_MS;
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.event === "notification" && payload.notification) {
            setItems((current) => [payload.notification, ...current]);
            setUnreadCount((current) => current + 1);
            // Lets whichever screen is open reload its own data (see
            // useLiveRefresh) -- the bell is the only thing holding
            // the socket, so this is how the rest of the UI hears.
            window.dispatchEvent(
              new CustomEvent(NOTIFICATION_EVENT, { detail: payload.notification }),
            );
          }
        } catch {
          // ignore malformed frames
        }
      };

      socket.onclose = () => {
        if (stopped) return;
        reconnectTimerRef.current = setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_DELAY_MS);
      };

      socket.onerror = () => {
        socket.close();
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      stopped = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      closeSafely(socketRef.current);
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { items, unreadCount, hasMore, loading, loadMore, markRead, markAllRead };
}
