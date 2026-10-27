import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Unauthorized from "./common/Unauthorized";

export default function RoleRoute({
  allowedRoles,
  children,
}) {
  const { loading, profile } = useAuth();
  const location = useLocation();

  if (loading) {
    return null;
  }

  if (!profile) {
    // profile can go null mid-session (token expiry, or an account
    // admin just disabled -- see AuthContext's account-disabled
    // listener), by which point the role it belonged to isn't known
    // anymore here. The URL prefix is a reliable enough substitute:
    // a customer never ends up under /pandit, and vice versa.
    const loginPath = location.pathname.startsWith("/pandit") ? "/pandit/login" : "/login";
    // Carries the page the visitor was trying to reach so the login
    // page can send them straight back once they're signed in (see
    // LoginPage.jsx), instead of always landing on the default
    // role dashboard -- used by the booking flow's login gate.
    return <Navigate to={loginPath} replace state={{ from: location.pathname + location.search }} />;
  }

  if (!allowedRoles.includes(profile.role)) {
    return <Unauthorized />;
  }

  return children;
}