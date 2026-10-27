import { del, get, patch, post } from "../api";

// --- Inbox (merged: system notifications + received messages) ---

export function listInbox({ offset = 0, limit = 20 } = {}) {
  return get("/messaging/inbox", { params: { offset, limit } });
}

export function getMessagingUnreadCount() {
  return get("/messaging/unread-count");
}

export function markInboxItemRead(itemId, kind) {
  return patch(`/messaging/inbox/${itemId}/read`, {}, { params: { kind } });
}

// --- Sent / Drafts ---

export function listSentMessages({ offset = 0, limit = 20 } = {}) {
  return get("/messaging/sent", { params: { offset, limit } });
}

export function listDraftMessages({ offset = 0, limit = 20 } = {}) {
  return get("/messaging/drafts", { params: { offset, limit } });
}

// --- Recipient lookup / search ---

// Exact-email lookup, usable by every role -- shows the sender who
// they're about to message (name + role) before Send is enabled.
export function lookupRecipient(email) {
  return get("/messaging/lookup-recipient", { params: { email } });
}

// Admin-only fuzzy name/email search for the compose autocomplete.
export function searchUsersForCompose(q) {
  return get("/messaging/search-users", { params: { q } });
}

// --- Compose / send / draft ---

export function composeMessage({ recipientEmail, subject, body, saveAsDraft = false }) {
  return post("/messaging", {
    recipient_email: recipientEmail,
    subject,
    body,
    save_as_draft: saveAsDraft,
  });
}

export function updateDraft(draftId, { recipientEmail, subject, body, saveAsDraft = true }) {
  return patch(`/messaging/drafts/${draftId}`, {
    recipient_email: recipientEmail,
    subject,
    body,
    save_as_draft: saveAsDraft,
  });
}

export function deleteDraft(draftId) {
  return del(`/messaging/drafts/${draftId}`);
}
