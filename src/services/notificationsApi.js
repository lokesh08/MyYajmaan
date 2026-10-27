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

// ws:// (or wss:// behind https) counterpart of the app's API base URL.
export function getNotificationsSocketUrl() {
  const baseURL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
  const wsBase = baseURL.replace(/^http/i, "ws");
  return `${wsBase}/notifications/ws`;
}
