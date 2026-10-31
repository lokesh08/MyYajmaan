import { forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import { t, translateServerText } from "../../i18n";

function timeAgo(isoString) {
  if (!isoString) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const NotificationPanel = forwardRef(function NotificationPanel(
  { items, hasMore, loading, onLoadMore, onItemClick, onMarkAllRead, onClose, style, inboxPath },
  ref,
) {
  const navigate = useNavigate();

  function handleScroll(event) {
    const el = event.currentTarget;
    // The overflow check matters: without it, a list short enough to
    // fit with no scrollbar (scrollHeight ~= clientHeight, scrollTop
    // 0) would trivially satisfy the "near the bottom" test below and
    // fire a load-more before the user ever actually scrolled.
    const hasOverflow = el.scrollHeight > el.clientHeight + 1;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
    if (hasOverflow && nearBottom) {
      onLoadMore();
    }
  }

  function handleItemClick(item) {
    onItemClick(item.id);
    onClose();
    if (item.link) {
      navigate(item.link);
    }
  }

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={t("Notifications")}
      style={style}
      className="z-[9999] w-[22rem] max-w-[90vw] overflow-hidden rounded-2xl border border-amber-100 bg-white text-slate-800 shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-amber-100 px-4 py-3">
        <p className="font-serif text-base font-semibold text-maroon">{t("Notifications")}</p>
        {items.length > 0 && (
          <button
            type="button"
            onClick={onMarkAllRead}
            title={t("Mark all notifications as read")}
            className="text-xs font-semibold text-maroon hover:text-saffron"
          >
            {t("Mark all as read")}
          </button>
        )}
      </div>

      <div onScroll={handleScroll} className="max-h-96 overflow-y-auto">
        {items.length === 0 && !loading && (
          <p className="px-4 py-8 text-center text-sm text-slate-400">{t("You're all caught up.")}</p>
        )}

        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            title={item.title}
            onClick={() => handleItemClick(item)}
            className="flex w-full flex-col items-start gap-0.5 border-b border-amber-50 px-4 py-3 text-left transition hover:bg-amber-50/60"
          >
            <span className="flex w-full items-start justify-between gap-2">
              <span className="text-sm font-semibold text-slate-700">{translateServerText(item.title)}</span>
              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-saffron" aria-hidden="true" />
            </span>
            {item.message && <span className="text-xs text-slate-500">{translateServerText(item.message)}</span>}
            <span className="text-xs text-slate-400">{timeAgo(item.created_at)}</span>
          </button>
        ))}

        {loading && <p className="py-3 text-center text-xs text-slate-400">{t("Loading...")}</p>}
      </div>

      {inboxPath && (
        <button
          type="button"
          onClick={() => {
            onClose();
            navigate(inboxPath);
          }}
          className="block w-full border-t border-amber-100 px-4 py-2.5 text-center text-xs font-semibold text-maroon hover:bg-amber-50"
        >
          {t("View all in Messaging Center →")}
        </button>
      )}
    </div>
  );
});

export default NotificationPanel;
