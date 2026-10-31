import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import useNotifications from "../../hooks/useNotifications";
import NotificationPanel from "./NotificationPanel";
import { t } from "../../i18n";

const THEME_BUTTON_CLASSES = {
  // For the dark maroon gradient header (customer + Pandit Ji portal).
  dark: "border-amber-200/40 text-amber-50 hover:bg-white/10",
  // For light/white headers (admin topbar).
  light: "border-amber-200 text-maroon hover:bg-amber-50",
};

export default function NotificationBell({ enabled = true, theme = "dark", inboxPath }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const { items, unreadCount, hasMore, loading, loadMore, markRead, markAllRead } = useNotifications(enabled);

  function updatePosition() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
  }

  function toggleOpen() {
    if (!open) updatePosition();
    setOpen((current) => !current);
  }

  useEffect(() => {
    if (!open) return undefined;

    function handleClickOutside(event) {
      if (
        buttonRef.current?.contains(event.target) ||
        panelRef.current?.contains(event.target)
      ) {
        return;
      }
      setOpen(false);
    }

    // The header this bell sits in uses overflow-hidden for its
    // ambient glow effects, which would clip an ordinary absolutely-
    // positioned dropdown right at the header's edge (exactly the
    // "notification box gets hidden behind" issue) -- rendering the
    // panel through a portal into document.body and positioning it
    // with fixed coordinates sidesteps that clipping entirely.
    // Scrolling the PAGE closes it rather than tracking position,
    // since the header isn't sticky and the anchor would otherwise
    // drift away from the button underneath it. Scroll listens on the
    // capture phase to catch scrolling anywhere on the page (scroll
    // events don't bubble), which also means it sees scrolling inside
    // the panel's own notification list -- that has to be excluded
    // explicitly, or the panel closes the instant someone scrolls it.
    function handleScroll(event) {
      if (panelRef.current?.contains(event.target)) {
        return;
      }
      setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

  if (!enabled) return null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        title={t("Notifications")}
        aria-label={t("Notifications{v0}", { v0: unreadCount > 0 ? `, ${unreadCount} unread` : "" })}
        aria-expanded={open}
        className={`interactive-button relative flex h-10 w-10 items-center justify-center rounded-full border transition ${THEME_BUTTON_CLASSES[theme] || THEME_BUTTON_CLASSES.dark}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-saffron px-1 text-[10px] font-bold text-maroon shadow-sm">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open &&
        position &&
        createPortal(
          <NotificationPanel
            ref={panelRef}
            style={{ position: "fixed", top: position.top, right: position.right }}
            items={items}
            hasMore={hasMore}
            loading={loading}
            onLoadMore={loadMore}
            onItemClick={markRead}
            onMarkAllRead={markAllRead}
            onClose={() => setOpen(false)}
            inboxPath={inboxPath}
          />,
          document.body,
        )}
    </div>
  );
}
