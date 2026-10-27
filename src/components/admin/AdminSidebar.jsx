import { NavLink } from "react-router-dom";
import { ADMIN_BASE_PATH } from "../../constants/adminRoutes";
import { optimizedImage } from "../../utils/image";

const MENU_ITEMS = [
  { label: "Dashboard", to: `${ADMIN_BASE_PATH}/dashboard` },
  { label: "Messaging Center", to: `${ADMIN_BASE_PATH}/messages` },
  { label: "Users", to: `${ADMIN_BASE_PATH}/users` },
  { label: "Pandit Ji", to: `${ADMIN_BASE_PATH}/pandits` },
  { label: "Pujas", to: `${ADMIN_BASE_PATH}/pujas` },
  { label: "Bookings", to: `${ADMIN_BASE_PATH}/bookings` },
  { label: "Package Pujas", to: `${ADMIN_BASE_PATH}/package-pujas` },
  { label: "Testimonials", to: `${ADMIN_BASE_PATH}/testimonials` },
  { label: "Shubh Muhurat", to: `${ADMIN_BASE_PATH}/muhurat` },
  { label: "Coupons & Offers", to: `${ADMIN_BASE_PATH}/coupons` },
  { label: "CMS", to: `${ADMIN_BASE_PATH}/cms` },
  { label: "Wallet & Transactions", to: `${ADMIN_BASE_PATH}/wallet` },
  { label: "Reports & Analytics", to: `${ADMIN_BASE_PATH}/reports` },
  { label: "Audit Log", to: `${ADMIN_BASE_PATH}/audit-log` },
  { label: "Settings", to: `${ADMIN_BASE_PATH}/settings` },
  { label: "Support", to: `${ADMIN_BASE_PATH}/support` },
  { label: "Complaints", to: `${ADMIN_BASE_PATH}/complaints` },
  { label: "Pandit Ji Feedback", to: `${ADMIN_BASE_PATH}/pandit-feedback` },
];

export default function AdminSidebar({ onLogout, open = false, onClose }) {
  return (
    <>
      {/* Backdrop: mobile only, shown while the drawer is open */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-64 shrink-0 flex-col border-r border-amber-100 bg-white transition-transform duration-200 ease-out md:static md:z-auto md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-amber-100 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 overflow-hidden rounded-full shadow-sm">
              <img src={optimizedImage("/images/logo-mark.png")} alt="MyYajmaan" className="h-full w-full object-cover" />
            </div>
            <div>
              <p className="font-serif text-lg font-semibold text-maroon">My Yajmaan</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-maroon md:hidden"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {MENU_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              className={({ isActive }) =>
                `block rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  isActive ? "bg-maroon text-white" : "text-slate-600 hover:bg-amber-50"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-amber-100 p-3">
          <button
            type="button"
            onClick={onLogout}
            className="interactive-button w-full rounded-xl px-4 py-2.5 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50"
          >
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
