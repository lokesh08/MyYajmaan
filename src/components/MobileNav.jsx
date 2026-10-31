import { useEffect, useRef } from "react";
import { Link, NavLink } from "react-router-dom";

import { formatRoleLabel } from "../utils/roleLabels";
import { t } from "../i18n";
import LanguageToggle from "../i18n/LanguageToggle";

/**
 * Slide-in menu for screens below `md`, where the header hides its nav
 * links and Login/Register/Logout buttons. Same links and actions as
 * the desktop header (Layout passes them in), so the two never drift.
 */
export default function MobileNav({ open, onClose, links, isAuthenticated, userName, role, onLinkClick, onLogout }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Keep the page behind the menu from scrolling while it's open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector("a, button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  const linkClass = ({ isActive }) =>
    `flex min-h-[48px] items-center rounded-xl px-4 text-base font-semibold transition ${
      isActive ? "bg-gradient-to-r from-saffron to-sand text-maroon" : "text-slate-700 hover:bg-amber-50"
    }`;

  return (
    // `invisible` once closed (after the slide-out finishes) also takes the
    // links out of the tab order and away from screen readers.
    <div
      className={`fixed inset-0 z-[90] transition-[visibility] duration-200 md:hidden ${
        open ? "visible" : "pointer-events-none invisible"
      }`}
    >
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />

      <nav
        id="mobile-nav"
        ref={panelRef}
        aria-label={t("Main menu")}
        className={`absolute right-0 top-0 flex h-full w-[82%] max-w-xs flex-col bg-white shadow-divine transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-amber-100 px-4 py-3">
          {isAuthenticated ? (
            <div>
              <p className="font-semibold text-maroon">{t("Hello,")}{' '}{userName}</p>
              <p className="text-xs text-slate-500">{t(formatRoleLabel(role))}</p>
            </div>
          ) : (
            <p className="font-serif text-lg font-semibold text-maroon">{t("Menu")}</p>
          )}
          <LanguageToggle tone="light" className="ml-auto mr-2" />
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Close menu")}
            className="flex h-11 w-11 items-center justify-center rounded-full text-2xl text-slate-500 hover:bg-amber-50"
          >
            ×
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {links.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === "/"} className={linkClass} onClick={() => onLinkClick(item)}>
              {t(item.label)}
            </NavLink>
          ))}
        </div>

        <div className="border-t border-amber-100 p-4">
          {isAuthenticated ? (
            <button
              type="button"
              onClick={onLogout}
              className="min-h-[48px] w-full rounded-full border border-maroon/30 px-4 text-sm font-semibold text-maroon hover:bg-maroon hover:text-white"
            >
              {t("Logout")}
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/login"
                onClick={onClose}
                className="flex min-h-[48px] items-center justify-center rounded-full border border-amber-200 text-sm font-semibold text-maroon"
              >
                {t("Login")}
              </Link>
              <Link
                to="/register"
                onClick={onClose}
                className="flex min-h-[48px] items-center justify-center rounded-full bg-maroon text-sm font-semibold text-white"
              >
                {t("Register")}
              </Link>
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}
