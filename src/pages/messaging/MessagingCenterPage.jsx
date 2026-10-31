import { useEffect, useRef, useState } from "react";

import useMessagingCenter from "../../hooks/useMessagingCenter";
import {
  composeMessage,
  deleteDraft,
  listDraftMessages,
  listSentMessages,
  lookupRecipient,
  searchUsersForCompose,
  updateDraft,
} from "../../services/messagingApi";
import { showError, showSuccess } from "../../utils/toaster";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import { t } from "../../i18n";

const TABS = [
  { key: "inbox", label: "Inbox" },
  { key: "sent", label: "Sent" },
  { key: "drafts", label: "Drafts" },
];

function initials(name) {
  if (!name) return "?";
  return name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

function timeAgo(isoString) {
  if (!isoString) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const EMPTY_COMPOSE = { draftId: null, recipientEmail: "", subject: "", body: "", resolvedRecipient: null };

/**
 * One shared page for all three portals -- see App.jsx for the three
 * routes this is mounted under. `portal` ("user" | "pandit" | "admin")
 * only ever changes one thing: whether the compose recipient field gets
 * admin's extra name/email autocomplete (search-users, admin-only on
 * the backend) on top of the exact-email lookup every role gets.
 */
export default function MessagingCenterPage({ portal }) {
  const [activeTab, setActiveTab] = useState("inbox");
  const [sentItems, setSentItems] = useState([]);
  const [draftItems, setDraftItems] = useState([]);
  const [loadingFolder, setLoadingFolder] = useState(false);

  const [selected, setSelected] = useState(null); // { kind: 'inbox-item' | 'sent' | 'draft', data }
  const [composing, setComposing] = useState(false);
  const [compose, setCompose] = useState(EMPTY_COMPOSE);
  const [resolving, setResolving] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [sending, setSending] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const suggestionTimer = useRef(null);

  const inbox = useMessagingCenter(true);

  useEffect(() => {
    if (activeTab === "sent") loadSent();
    if (activeTab === "drafts") loadDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  function loadSent() {
    setLoadingFolder(true);
    listSentMessages({ limit: 50 })
      .then((data) => setSentItems(data?.items || []))
      .catch(() => showError(t("Could not load Sent messages.")))
      .finally(() => setLoadingFolder(false));
  }

  function loadDrafts() {
    setLoadingFolder(true);
    listDraftMessages({ limit: 50 })
      .then((data) => setDraftItems(data?.items || []))
      .catch(() => showError(t("Could not load Drafts.")))
      .finally(() => setLoadingFolder(false));
  }

  function openInboxItem(item) {
    setComposing(false);
    setSelected({ kind: "inbox-item", data: item });
    setMobileShowDetail(true);
    inbox.markRead(item);
  }

  function openSentItem(item) {
    setComposing(false);
    setSelected({ kind: "sent", data: item });
    setMobileShowDetail(true);
  }

  function openDraft(item) {
    setComposing(true);
    setSelected({ kind: "draft", data: item });
    setCompose({
      draftId: item.id,
      recipientEmail: item.recipient_email || "",
      subject: item.subject || "",
      body: item.body || "",
      resolvedRecipient: item.recipient_email
        ? { email: item.recipient_email, full_name: item.recipient_name, role: item.recipient_role }
        : null,
    });
    setMobileShowDetail(true);
  }

  function startCompose() {
    setSelected(null);
    setComposing(true);
    setCompose(EMPTY_COMPOSE);
    setSuggestions([]);
    setMobileShowDetail(true);
  }

  function backToList() {
    setMobileShowDetail(false);
  }

  function updateComposeField(field, value) {
    setCompose((current) => ({
      ...current,
      [field]: value,
      ...(field === "recipientEmail" && current.resolvedRecipient?.email !== value ? { resolvedRecipient: null } : {}),
    }));
    if (field === "recipientEmail" && portal === "admin") {
      if (suggestionTimer.current) clearTimeout(suggestionTimer.current);
      suggestionTimer.current = setTimeout(() => {
        if (value.trim().length < 2) {
          setSuggestions([]);
          return;
        }
        searchUsersForCompose(value.trim())
          .then((data) => setSuggestions(data?.items || []))
          .catch(() => {});
      }, 300);
    }
  }

  function pickSuggestion(user) {
    setCompose((current) => ({ ...current, recipientEmail: user.email, resolvedRecipient: user }));
    setSuggestions([]);
  }

  async function handleFindRecipient() {
    const email = compose.recipientEmail.trim();
    if (!email) return;
    setResolving(true);
    try {
      const recipient = await lookupRecipient(email);
      setCompose((current) => ({ ...current, resolvedRecipient: recipient }));
    } catch (error) {
      setCompose((current) => ({ ...current, resolvedRecipient: null }));
      showError(error?.data?.detail?.message || error?.message || t("No user found with that email address."));
    } finally {
      setResolving(false);
    }
  }

  function validateBeforeSend() {
    if (!compose.resolvedRecipient || compose.resolvedRecipient.email !== compose.recipientEmail.trim()) {
      showError(t("Please find and confirm a recipient first."));
      return false;
    }
    if (!compose.subject.trim()) {
      showError(t("Please enter a subject."));
      return false;
    }
    if (!compose.body.trim()) {
      showError(t("Please write a message."));
      return false;
    }
    return true;
  }

  async function handleSend() {
    if (!validateBeforeSend()) return;
    setSending(true);
    try {
      if (compose.draftId) {
        await updateDraft(compose.draftId, {
          recipientEmail: compose.recipientEmail.trim(),
          subject: compose.subject.trim(),
          body: compose.body.trim(),
          saveAsDraft: false,
        });
      } else {
        await composeMessage({
          recipientEmail: compose.recipientEmail.trim(),
          subject: compose.subject.trim(),
          body: compose.body.trim(),
          saveAsDraft: false,
        });
      }
      showSuccess(t("Message sent."));
      setComposing(false);
      setCompose(EMPTY_COMPOSE);
      setMobileShowDetail(false);
      if (activeTab === "sent") loadSent();
      if (activeTab === "drafts") loadDrafts();
    } catch (error) {
      showError(error?.data?.detail?.message || error?.message || t("Could not send this message."));
    } finally {
      setSending(false);
    }
  }

  async function handleSaveDraft() {
    if (!compose.subject.trim() && !compose.body.trim() && !compose.recipientEmail.trim()) {
      showError(t("Nothing to save yet."));
      return;
    }
    setSending(true);
    try {
      if (compose.draftId) {
        await updateDraft(compose.draftId, {
          recipientEmail: compose.recipientEmail.trim(),
          subject: compose.subject.trim() || "(No subject)",
          body: compose.body.trim(),
          saveAsDraft: true,
        });
      } else {
        await composeMessage({
          recipientEmail: compose.recipientEmail.trim(),
          subject: compose.subject.trim() || "(No subject)",
          body: compose.body.trim(),
          saveAsDraft: true,
        });
      }
      showSuccess(t("Draft saved."));
      setComposing(false);
      setCompose(EMPTY_COMPOSE);
      setMobileShowDetail(false);
      if (activeTab === "drafts") loadDrafts();
    } catch (error) {
      showError(error?.data?.detail?.message || error?.message || t("Could not save this draft."));
    } finally {
      setSending(false);
    }
  }

  async function confirmDeleteDraft() {
    if (!deleteTarget) return;
    try {
      await deleteDraft(deleteTarget.id);
      showSuccess(t("Draft deleted."));
      setDraftItems((current) => current.filter((item) => item.id !== deleteTarget.id));
      if (selected?.kind === "draft" && selected.data.id === deleteTarget.id) {
        setSelected(null);
        setComposing(false);
        setMobileShowDetail(false);
      }
    } catch (error) {
      showError(error?.message || t("Could not delete this draft."));
    } finally {
      setDeleteTarget(null);
    }
  }

  const listForTab = activeTab === "inbox" ? inbox.items : activeTab === "sent" ? sentItems : draftItems;
  const listLoading = activeTab === "inbox" ? inbox.loading && inbox.items.length === 0 : loadingFolder;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-maroon">{t("Messaging Center")}</h1>
          <p className="text-sm text-slate-500">{t("All your updates and messages, in one place.")}</p>
        </div>
        <button
          type="button"
          onClick={startCompose}
          className="interactive-button rounded-full bg-maroon px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-maroon"
        >
          {t("✎ Compose")}
        </button>
      </div>

      <div className="flex overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm" style={{ minHeight: "32rem" }}>
        {/* List pane */}
        <div className={`w-full shrink-0 border-r border-amber-100 md:w-80 ${mobileShowDetail ? "hidden md:flex md:flex-col" : "flex flex-col"}`}>
          <div className="flex border-b border-amber-100">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  setMobileShowDetail(false);
                }}
                className={`flex-1 px-3 py-3 text-sm font-semibold transition ${
                  activeTab === tab.key ? "border-b-2 border-maroon text-maroon" : "text-slate-500 hover:text-maroon"
                }`}
              >
                {t(tab.label)}
                {tab.key === "inbox" && inbox.unreadCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-saffron px-1.5 py-0.5 text-[10px] font-bold text-maroon">{inbox.unreadCount}</span>
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {listLoading && <p className="py-8 text-center text-sm text-slate-400">{t("Loading...")}</p>}
            {!listLoading && listForTab.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-slate-400">
                {activeTab === "inbox" ? t("You're all caught up.") : activeTab === "sent" ? t("No sent messages yet.") : t("No drafts.")}
              </p>
            )}

            {activeTab === "inbox" &&
              listForTab.map((item) => (
                <button
                  key={`${item.kind}-${item.id}`}
                  type="button"
                  onClick={() => openInboxItem(item)}
                  className={`flex w-full items-start gap-3 border-b border-amber-50 px-4 py-3 text-left transition hover:bg-amber-50/60 ${
                    selected?.kind === "inbox-item" && selected.data.id === item.id ? "bg-amber-50" : ""
                  }`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${item.kind === "message" ? "bg-gradient-to-br from-amber-100 to-orange-100 text-maroon" : "bg-slate-100 text-slate-500"}`}>
                    {item.kind === "message" ? initials(item.from_name) : "🔔"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={`truncate text-sm ${!item.is_read ? "font-bold text-slate-800" : "font-medium text-slate-600"}`}>{item.from_name}</span>
                      {!item.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-saffron" aria-hidden="true" />}
                    </span>
                    <span className={`block truncate text-xs ${!item.is_read ? "font-semibold text-slate-700" : "text-slate-500"}`}>{t(item.title)}</span>
                    <span className="text-xs text-slate-400">{timeAgo(item.created_at)}</span>
                  </span>
                </button>
              ))}

            {activeTab === "sent" &&
              listForTab.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openSentItem(item)}
                  className={`flex w-full flex-col items-start gap-0.5 border-b border-amber-50 px-4 py-3 text-left transition hover:bg-amber-50/60 ${
                    selected?.kind === "sent" && selected.data.id === item.id ? "bg-amber-50" : ""
                  }`}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-slate-700">{t("To:")}{' '}{item.recipient_name || item.recipient_email}</span>
                  </span>
                  <span className="block truncate text-xs text-slate-500">{item.subject}</span>
                  <span className="text-xs text-slate-400">{timeAgo(item.sent_at || item.created_at)}</span>
                </button>
              ))}

            {activeTab === "drafts" &&
              listForTab.map((item) => (
                <div
                  key={item.id}
                  className={`flex w-full items-start justify-between gap-2 border-b border-amber-50 px-4 py-3 transition hover:bg-amber-50/60 ${
                    selected?.kind === "draft" && selected.data.id === item.id ? "bg-amber-50" : ""
                  }`}
                >
                  <button type="button" onClick={() => openDraft(item)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-medium text-slate-700">
                      {t("To:")}{' '}{item.recipient_name || item.recipient_email || <span className="italic text-slate-400">{t("Not addressed yet")}</span>}
                    </span>
                    <span className="block truncate text-xs text-slate-500">{item.subject || t("(No subject)")}</span>
                    <span className="text-xs text-slate-400">{timeAgo(item.updated_at || item.created_at)}</span>
                  </button>
                  <button
                    type="button"
                    title={t("Delete draft")}
                    onClick={() => setDeleteTarget(item)}
                    className="interactive-button shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    ✕
                  </button>
                </div>
              ))}

            {activeTab === "inbox" && inbox.hasMore && !listLoading && (
              <button type="button" onClick={inbox.loadMore} className="interactive-button w-full py-3 text-center text-xs font-semibold text-maroon hover:bg-amber-50">
                {t("Load more")}
              </button>
            )}
          </div>
        </div>

        {/* Detail / compose pane */}
        <div className={`min-w-0 flex-1 flex-col ${mobileShowDetail ? "flex" : "hidden md:flex"}`}>
          <button type="button" onClick={backToList} className="interactive-button flex items-center gap-1.5 border-b border-amber-100 px-4 py-3 text-sm font-semibold text-maroon md:hidden">
            {t("← Back")}
          </button>

          {!composing && !selected && (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-slate-400">
              {t("Select a message, or click Compose to write a new one.")}
            </div>
          )}

          {!composing && selected?.kind === "inbox-item" && (
            <div className="flex-1 overflow-y-auto p-5">
              <h2 className="font-serif text-xl font-semibold text-maroon">{t(selected.data.title)}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {t("From:")}{' '}{selected.data.from_name} · {timeAgo(selected.data.created_at)}
              </p>
              <div className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selected.data.body}</div>
              {selected.data.link && (
                <a href={selected.data.link} className="mt-4 inline-block text-sm font-semibold text-maroon hover:underline">
                  {t("View details →")}
                </a>
              )}
            </div>
          )}

          {!composing && selected?.kind === "sent" && (
            <div className="flex-1 overflow-y-auto p-5">
              <h2 className="font-serif text-xl font-semibold text-maroon">{selected.data.subject}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {t("To:")}{' '}{selected.data.recipient_name || selected.data.recipient_email} · {timeAgo(selected.data.sent_at || selected.data.created_at)}
              </p>
              <div className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selected.data.body}</div>
            </div>
          )}

          {composing && (
            <div className="flex flex-1 flex-col overflow-y-auto p-5">
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">{t("To (email address)")}</span>
                  <div className="relative flex gap-2">
                    <input
                      value={compose.recipientEmail}
                      onChange={(event) => updateComposeField("recipientEmail", event.target.value)}
                      placeholder={t("name@example.com")}
                      className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
                    />
                    <button
                      type="button"
                      onClick={handleFindRecipient}
                      disabled={resolving || !compose.recipientEmail.trim()}
                      className="interactive-button shrink-0 rounded-xl border border-amber-200 px-3 py-2 text-xs font-semibold text-maroon disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {resolving ? t("Finding...") : t("Find")}
                    </button>

                    {suggestions.length > 0 && (
                      <div className="absolute left-0 top-full z-10 mt-1 w-full overflow-hidden rounded-xl border border-amber-100 bg-white shadow-lg">
                        {suggestions.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => pickSuggestion(user)}
                            className="flex w-full flex-col items-start gap-0 px-3 py-2 text-left text-sm hover:bg-amber-50"
                          >
                            <span className="font-medium text-slate-700">{user.full_name} <span className="text-xs text-slate-400">({user.role_label})</span></span>
                            <span className="text-xs text-slate-400">{user.email}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {compose.resolvedRecipient && compose.resolvedRecipient.email === compose.recipientEmail.trim() && (
                    <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {t("✓ To:")}{' '}{compose.resolvedRecipient.full_name} ({compose.resolvedRecipient.role_label})
                    </span>
                  )}
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">{t("Subject")}</span>
                  <input
                    value={compose.subject}
                    onChange={(event) => updateComposeField("subject", event.target.value)}
                    placeholder={t("Subject")}
                    className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
                  />
                </label>

                <label className="block flex-1">
                  <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">{t("Message")}</span>
                  <textarea
                    value={compose.body}
                    onChange={(event) => updateComposeField("body", event.target.value)}
                    rows={10}
                    placeholder={t("Write your message...")}
                    className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sending}
                  className="interactive-button rounded-full bg-maroon px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-maroon disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sending ? t("Sending...") : t("Send")}
                </button>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={sending}
                  className="interactive-button rounded-full border border-amber-200 bg-white px-5 py-2.5 text-sm font-semibold text-maroon hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t("Save as Draft")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setComposing(false);
                    setSelected(null);
                    setMobileShowDetail(false);
                  }}
                  className="interactive-button rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  {t("Cancel")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t("Delete draft?")}
        message={t("This draft will be permanently deleted.")}
        confirmLabel={t("Delete")}
        confirmClassName="bg-rose-600 hover:bg-rose-700"
        onConfirm={confirmDeleteDraft}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
