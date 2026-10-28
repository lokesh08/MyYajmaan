import { useCallback, useEffect, useRef, useState } from "react";

import { getNotificationsSocketUrl } from "../services/notificationsApi";
import { getMessagingUnreadCount, listInbox, markInboxItemRead } from "../services/messagingApi";

const RECONNECT_START_DELAY_MS = 500;
const RECONNECT_MAX_DELAY_MS = 15000;

function closeSafely(socket) {
  if (!socket) return;
  if (socket.readyState === WebSocket.CONNECTING) {
    socket.addEventListener("open", () => socket.close(), { once: true });
  } else {
    socket.close();
  }
}

/**
 * Backs the Messaging Center's Inbox tab. Deliberately a separate hook
 * from useNotifications (the bell's dropdown) rather than sharing code
 * with it -- that one is "unread only, dropdown-sized"; this one is a
 * permanent, paginated log that also needs to react to a second live
 * event type (`message`, not just `notification`). Both connect to the
 * *same* /notifications/ws endpoint though (one socket per tab is
 * enough -- see notifications.py's ConnectionManager, which is keyed
 * purely by user_id and doesn't care which hook opened the connection).
 */
export default function useMessagingCenter(enabled) {
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const mountedRef = useRef(true);

  const refreshUnreadCount = useCallback(() => {
    getMessagingUnreadCount()
      .then((data) => mountedRef.current && setUnreadCount(data?.count || 0))
      .catch(() => {});
  }, []);

  const loadFirstPage = useCallback(() => {
    setLoading(true);
    listInbox({ offset: 0, limit: 20 })
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
    listInbox({ offset: items.length, limit: 20 })
      .then((data) => {
        if (!mountedRef.current) return;
        setItems((current) => [...current, ...(data?.items || [])]);
        setHasMore(Boolean(data?.has_more));
      })
      .catch(() => {})
      .finally(() => mountedRef.current && setLoading(false));
  }, [loading, hasMore, items]);

  const markRead = useCallback((item) => {
    if (!item || item.is_read) return;
    setItems((current) => current.map((existing) => (existing.id === item.id ? { ...existing, is_read: true } : existing)));
    setUnreadCount((current) => Math.max(0, current - 1));
    markInboxItemRead(item.id, item.kind).catch(() => {});
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) return undefined;

    refreshUnreadCount();
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
        reconnectDelay = RECONNECT_START_DELAY_MS;
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.event === "notification" && payload.notification) {
            const n = payload.notification;
            setItems((current) => [
              { id: n.id, kind: "notification", title: n.title, body: n.message, from_name: "MyYajmaan", is_read: false, link: n.link, created_at: n.created_at },
              ...current,
            ]);
            setUnreadCount((current) => current + 1);
          } else if (payload?.event === "message" && payload.message) {
            const m = payload.message;
            setItems((current) => [
              { id: m.id, kind: "message", title: m.subject, body: m.body, from_name: m.from_name, is_read: false, link: null, created_at: m.created_at },
              ...current,
            ]);
            setUnreadCount((current) => current + 1);
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

  return { items, hasMore, loading, unreadCount, loadMore, markRead, refresh: loadFirstPage };
}
