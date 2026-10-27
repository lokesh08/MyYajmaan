import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { clearBookingDraft } from "../utils/bookingFlowStorage";
import { formatRoleLabel } from "../utils/roleLabels";
import { getLoginPathForRole } from "../utils/roleRoutes";
import NotificationBell from "./notifications/NotificationBell";
import { useAuth } from "../context/AuthContext";
import { ADMIN_BASE_PATH, ADMIN_DASHBOARD_PATH } from "../constants/adminRoutes";
import Footer from "./Footer";
import { optimizedImage } from "../utils/image";

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

  // Temporarily disabled per request -- not needed right now. Uncomment
  // both this and its spot in `links` below to bring it back.
  // const browsePanditsLink = { label: "Browse Pandit Ji", to: "/browse-pandits" };

  const links = isAuthenticated
    ? role === "user"
      ? [...commonLinks, /* browsePanditsLink, */ dashboardLink]
      : [...commonLinks, dashboardLink]
    : commonLinks;

  async function handleLogout() {
    const destination = getLoginPathForRole(role);
    await logout();
    navigate(destination);
  }

  return (
    <div className="min-h-screen bg-cream text-slate-800">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-maroon focus:shadow-card"
      >
        Skip to main content
      </a>
      <header className="relative overflow-hidden bg-gradient-to-r from-maroon-night via-maroon-dark to-maroon-night shadow-panel-dark">
        {/* ambient golden light, like diya glow either side of a temple arch */}
        <div className="pointer-events-none absolute -left-10 -top-24 h-56 w-56 rounded-full bg-saffron/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 -top-24 h-56 w-56 rounded-full bg-saffron/25 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-glow-gold" />

        {/* thin shimmering hairline along the very top edge */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/70 to-transparent" />

        <div className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" title="MyYajmaan home" className="flex items-center gap-3">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
              <div className="pointer-events-none absolute inset-0 animate-[spin_16s_linear_infinite] rounded-full border border-dashed border-amber-200/40" />
              <div className="pointer-events-none absolute -inset-1.5 animate-[spin_26s_linear_infinite_reverse] rounded-full border border-amber-200/20" />

              <div className="h-11 w-11 overflow-hidden rounded-full shadow-glow-gold">
                <img src={optimizedImage("/images/logo-mark.png")} alt="MyYajmaan" className="h-full w-full object-cover" />
              </div>
            </div>

            <div>
              <p className="font-serif text-xl font-semibold text-amber-50">
                MyYajmaan
              </p>

              <p className="text-sm text-amber-200/70">
                Divine puja booking
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
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-4 flex items-center gap-3">
            {!isAuthenticated ? (
              <>
                <Link
                  to="/login"
                  title="Login to your account"
                  className="interactive-button hidden rounded-full px-4 py-2 text-sm font-medium text-amber-50 hover:bg-white/10 md:inline-block"
                >
                  Login
                </Link>

                <Link
                  to="/register"
                  title="Create a new account"
                  className="interactive-button hidden rounded-full bg-gradient-to-r from-saffron to-sand px-4 py-2 text-sm font-semibold text-maroon shadow-glow-gold-sm hover:shadow-glow-gold-md md:inline-block"
                >
                  Register
                </Link>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <NotificationBell theme="dark" inboxPath={role === "pandit" ? "/pandit/messages" : "/dashboard/messages"} />

                <div className="hidden text-right md:block">
                  <p className="text-sm font-semibold text-amber-50">
                    Hello, {userName}
                  </p>

                  <p className="text-xs text-amber-200/70">
                    {formatRoleLabel(role)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="interactive-button rounded-full border border-amber-200/40 px-4 py-2 text-sm font-semibold text-amber-50 hover:bg-white/10"
                >
                  Logout
                </button>
              </div>
            )}
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

      <main id="main-content" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <Footer />
    </div>
  );
}