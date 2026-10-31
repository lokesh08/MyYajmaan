import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { clearBookingDraft } from "../utils/bookingFlowStorage";
import { formatRoleLabel } from "../utils/roleLabels";
import { getLoginPathForRole } from "../utils/roleRoutes";
import NotificationBell from "./notifications/NotificationBell";
import { useAuth } from "../context/AuthContext";
import { ADMIN_BASE_PATH, ADMIN_DASHBOARD_PATH } from "../constants/adminRoutes";
import Footer from "./Footer";
import MobileNav from "./MobileNav";
import { optimizedImage } from "../utils/image";
import { t } from "../i18n";
import LanguageToggle from "../i18n/LanguageToggle";

const commonLinks = [
  { label: "Home", to: "/" },
  { label: "Book Puja", to: "/book" },
  { label: "Contact Us", to: "/contact-us" },
];

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    isAuthenticated,
    role,
    userName,
    logout,
  } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // Any navigation (a menu link, the browser's Back button) closes it.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // The admin portal renders its own sidebar/topbar chrome.
  if (location.pathname.startsWith(ADMIN_BASE_PATH)) {
    return children;
  }

  const dashboardLink =
    role === "admin"
      ? { label: "Admin Dashboard", to: ADMIN_DASHBOARD_PATH }
      : role === "pandit"
        ? { label: "Pandit Dashboard", to: "/pandit" }
        : { label: "Yajmaan Dashboard", to: "/dashboard" };

  const links = isAuthenticated ? [...commonLinks, dashboardLink] : commonLinks;

  async function handleLogout() {
    const destination = getLoginPathForRole(role);
    setMenuOpen(false);
    await logout();
    navigate(destination);
  }

  function handleNavLinkClick(item) {
    if (item.to === "/book") {
      clearBookingDraft();
    }
    setMenuOpen(false);
  }

  return (
    <div className="min-h-screen bg-cream text-slate-800">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-maroon focus:shadow-card"
      >
        {t("Skip to main content")}
      </a>
      <header className="relative overflow-hidden bg-gradient-to-r from-maroon-night via-maroon-dark to-maroon-night shadow-panel-dark">
        {/* ambient golden light, like diya glow either side of a temple arch */}
        <div className="pointer-events-none absolute -left-10 -top-24 h-56 w-56 rounded-full bg-saffron/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 -top-24 h-56 w-56 rounded-full bg-saffron/25 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-glow-gold" />

        {/* thin shimmering hairline along the very top edge */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/70 to-transparent" />

        <div className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" title={t("MyYajmaan home")} className="flex items-center gap-3">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
              <div className="pointer-events-none absolute inset-0 animate-[spin_16s_linear_infinite] rounded-full border border-dashed border-amber-200/40" />
              <div className="pointer-events-none absolute -inset-1.5 animate-[spin_26s_linear_infinite_reverse] rounded-full border border-amber-200/20" />

              <div className="h-11 w-11 overflow-hidden rounded-full shadow-glow-gold">
                <img src={optimizedImage("/images/logo-mark.png")} alt={t("MyYajmaan")} className="h-full w-full object-cover" />
              </div>
            </div>

            <div>
              <p className="font-serif text-xl font-semibold text-amber-50">
                {t("MyYajmaan")}
              </p>

              <p className="text-sm text-amber-200/70">
                {t("Divine puja booking")}
              </p>
            </div>
          </Link>

          <nav className="hidden gap-4 md:flex">
            {links.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={item.label}
                onClick={() => {
                  if (item.to === "/book") {
                    clearBookingDraft();
                  }
                }}
                className={({ isActive }) =>
                  `rounded-full px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-gradient-to-r from-saffron to-sand text-maroon shadow-sm"
                      : "text-amber-50/80 hover:bg-white/10 hover:text-white"
                  }`
                }
              >
                {t(item.label)}
              </NavLink>
            ))}
          </nav>

          <div className="ml-4 flex items-center gap-3">
            {/* EN | हिं -- on phones it is in the ☰ menu instead (no room here). */}
            <LanguageToggle tone="dark" className="hidden sm:inline-flex" />
            {!isAuthenticated ? (
              <>
                <Link
                  to="/login"
                  title={t("Login to your account")}
                  className="interactive-button hidden rounded-full px-4 py-2 text-sm font-medium text-amber-50 hover:bg-white/10 md:inline-block"
                >
                  {t("Login")}
                </Link>

                <Link
                  to="/register"
                  title={t("Create a new account")}
                  className="interactive-button hidden rounded-full bg-gradient-to-r from-saffron to-sand px-4 py-2 text-sm font-semibold text-maroon shadow-glow-gold-sm hover:shadow-glow-gold-md md:inline-block"
                >
                  {t("Register")}
                </Link>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <NotificationBell theme="dark" inboxPath={role === "pandit" ? "/pandit/messages" : "/dashboard/messages"} />

                <div className="hidden text-right md:block">
                  <p className="text-sm font-semibold text-amber-50">
                    {t("Hello,")}{' '}{userName}
                  </p>

                  <p className="text-xs text-amber-200/70">
                    {t(formatRoleLabel(role))}
                  </p>
                </div>

                {/* On phones Logout lives in the menu, next to the greeting. */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="interactive-button hidden rounded-full border border-amber-200/40 px-4 py-2 text-sm font-semibold text-amber-50 hover:bg-white/10 md:inline-block"
                >
                  {t("Logout")}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label={t("Open menu")}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-amber-200/40 text-amber-50 hover:bg-white/10 md:hidden"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* beaded gold border, like a string of temple bells along the base */}
        <div
          className="pointer-events-none h-2 opacity-80"
          style={{
            backgroundImage:
              "radial-gradient(circle, var(--color-sand) 0 2px, transparent 2.6px)",
            backgroundSize: "16px 16px",
            backgroundPosition: "center",
          }}
        />
      </header>

      <MobileNav
        open={menuOpen}
        onClose={closeMenu}
        links={links}
        isAuthenticated={isAuthenticated}
        userName={userName}
        role={role}
        onLinkClick={handleNavLinkClick}
        onLogout={handleLogout}
      />

      <main id="main-content" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <Footer />
    </div>
  );
}