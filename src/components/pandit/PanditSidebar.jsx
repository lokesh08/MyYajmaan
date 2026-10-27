import { NavLink } from "react-router-dom";
import { optimizedImage } from "../../utils/image";

const MENU_ITEMS = [
  { label: "Dashboard", to: "/pandit/dashboard", icon: "🏠" },
  { label: "My Profile", to: "/pandit/profile", icon: "🧑" },
  { label: "My Pujas", to: "/pandit/pujas", icon: "🪔" },
  { label: "Manage Bookings", to: "/pandit/bookings", icon: "📅" },
  { label: "Upload Photos", to: "/pandit/photos", icon: "📷" },
  { label: "Feedback for Admin", to: "/pandit/feedback", icon: "💬" },
  { label: "Messaging Center", to: "/pandit/messages", icon: "📥" },
  { label: "My Wallet", to: "/pandit/wallet", icon: "💰" },
];

export default function PanditSidebar({ open = false, onClose }) {
  return (
    <>
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
              <p className="font-serif text-lg font-semibold text-maroon">Pandit Ji Portal</p>
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
                `flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  isActive ? "bg-maroon text-white" : "text-slate-600 hover:bg-amber-50"
                }`
              }
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
