import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { adminLogout, adminMe } from "../../services/adminApi";
import { ADMIN_LOGIN_PATH } from "../../constants/adminRoutes";
import { showInfo, showSuccess } from "../../utils/toaster";
import {
  clearSessionBroadcast,
  subscribeToSessionChanges,
} from "../../utils/sessionBroadcast";
import useIdleLogout, { clearLastActivity } from "../../hooks/useIdleLogout";
import { IDLE_LOGOUT_MS } from "../../config/appConfig";
import AdminSidebar from "./AdminSidebar";
import AdminTopbar from "./AdminTopbar";

export default function AdminLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState("checking");
  const [admin, setAdmin] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const adminRef = useRef(null);

  // Close the mobile drawer whenever the admin navigates to a new page.
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    adminMe()
      .then((result) => {
        setAdmin(result?.user || null);
        adminRef.current = result?.user || null;
        setStatus("ready");
      })
      .catch(() => setStatus("unauthorized"));
  }, []);

  // Another tab signed in with a different account (or signed
  // out), which replaces this browser's only active session.
  useEffect(() => {
    return subscribeToSessionChanges((marker) => {
      if (!adminRef.current) {
        return;
      }

      if (marker && marker.userId === adminRef.current.id) {
        return;
      }

      adminRef.current = null;
      setStatus("unauthorized");
      showInfo(
        "You were signed out because another account signed in on this browser.",
      );
    });
  }, []);

  // Backend re-checks account status on every request, not just at
  // login -- another admin disabling/blocking this account mid-session
  // surfaces here the moment the next API call fails.
  useEffect(() => {
    function handleAccountDisabled(event) {
      if (!adminRef.current) return;
      adminRef.current = null;
      setStatus("unauthorized");
      showInfo(event.detail?.message || "Your account is no longer active. Please contact support.");
    }

    window.addEventListener("myyajmaan:account-disabled", handleAccountDisabled);
    return () => window.removeEventListener("myyajmaan:account-disabled", handleAccountDisabled);
  }, []);

  // Same inactivity rule as the customer / Pandit Ji portals.
  useIdleLogout(status === "ready", async () => {
    try {
      await adminLogout();
    } catch {
      // Cookies may already be gone; sign out locally regardless.
    }
    clearSessionBroadcast();
    adminRef.current = null;
    showInfo(`You were signed out after ${Math.round(IDLE_LOGOUT_MS / 60000)} minutes of inactivity.`);
    navigate(ADMIN_LOGIN_PATH, { replace: true });
  });

  async function handleLogout() {
    try {
      await adminLogout();
    } finally {
      clearSessionBroadcast();
      clearLastActivity();
      showSuccess("Logged out successfully.");
      navigate(ADMIN_LOGIN_PATH, { replace: true });
    }
  }

  if (status === "checking") {
    return <div className="flex min-h-screen items-center justify-center bg-cream text-slate-500">Loading admin portal...</div>;
  }

  if (status === "unauthorized") {
    return <Navigate to={ADMIN_LOGIN_PATH} replace />;
  }

  return (
    <div className="flex min-h-screen bg-cream">
      <AdminSidebar
        onLogout={handleLogout}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="min-w-0 flex-1">
        <AdminTopbar
          adminName={admin?.full_name || "Admin"}
          onMenuClick={() => setSidebarOpen((current) => !current)}
        />
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
