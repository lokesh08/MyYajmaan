import { Navigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { ADMIN_DASHBOARD_PATH } from "../constants/adminRoutes";

const DASHBOARD_BY_ROLE = {
  admin: ADMIN_DASHBOARD_PATH,
  pandit: "/pandit",
  user: "/dashboard",
};

/**
 * Wraps login/register pages so an already-logged-in visitor is sent
 * straight to their dashboard instead of seeing a login form again
 * (for any role — customer, Pandit Ji, or admin).
 */
export default function GuestOnlyRoute({ children }) {
  const { loading, profile } = useAuth();

  if (loading) {
    return null;
  }

  if (profile) {
    const destination = DASHBOARD_BY_ROLE[profile.role] || "/dashboard";
    return <Navigate to={destination} replace />;
  }

  return children;
}
