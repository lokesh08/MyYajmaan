import { get, patch } from "../api";

export function listNotifications({ offset = 0, limit = 6 } = {}) {
  return get("/notifications", { params: { offset, limit } });
}

export function getUnreadNotificationCount() {
  return get("/notifications/unread-count");
}

export function markNotificationRead(id) {
  return patch(`/notifications/${id}/read`, {});
}

export function markAllNotificationsRead() {
  return patch("/notifications/mark-all-read", {});
}

// Vercel's /api rewrite can't proxy a WebSocket, so in production the
// socket goes straight to the API host (VITE_WS_BASE_URL), where the
// session cookie isn't sent -- it authenticates with a short-lived
// ticket fetched over the normal (cookie-authenticated) API instead.
export async function getNotificationsSocketUrl() {
  const base = import.meta.env.VITE_WS_BASE_URL || import.meta.env.VITE_API_BASE_URL || window.location.origin;
  const wsBase = new URL(base, window.location.origin).href.replace(/\/$/, "").replace(/^http/i, "ws");
  const { ticket } = await get("/notifications/ws-ticket");
  return `${wsBase}/notifications/ws?ticket=${encodeURIComponent(ticket)}`;
}
