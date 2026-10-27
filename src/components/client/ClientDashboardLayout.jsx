import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { ClientPortalProvider } from "../../context/ClientPortalContext";
import { showSuccess } from "../../utils/toaster";
import ClientSidebar from "./ClientSidebar";

function LayoutBody({ children }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  async function handleLogout() {
    await logout();
    showSuccess("Logged out successfully.");
    navigate("/login");
  }

  return (
    <div className="flex min-h-[calc(100vh-6rem)] bg-cream">
      <ClientSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onLogout={handleLogout} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3 border-b border-amber-100 bg-white px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen((current) => !current)}
            aria-label="Toggle menu"
            className="interactive-button rounded-lg border border-amber-200 p-2 text-maroon"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
            </svg>
          </button>
          <p className="font-serif text-lg font-semibold text-maroon">My Account</p>
        </div>

        <main className="space-y-4 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

export default function ClientDashboardLayout({ children }) {
  return (
    <ClientPortalProvider>
      <LayoutBody>{children}</LayoutBody>
    </ClientPortalProvider>
  );
}
