import { useEffect } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { showInfo } from "../utils/toaster";

/**
 * Opposite of RoleRoute: lets everyone through (including guests)
 * EXCEPT the given roles, who get redirected away with an
 * explanation. Used to keep e.g. a logged-in Pandit Ji out of the
 * customer booking flow without blocking guests/customers from it.
 */
export default function BlockRoleRoute({ blockedRoles, redirectTo, message, children }) {
  const { loading, role } = useAuth();
  const isBlocked = !loading && Boolean(role) && blockedRoles.includes(role);

  useEffect(() => {
    if (isBlocked && message) {
      showInfo(message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBlocked]);

  if (loading) {
    return null;
  }

  if (isBlocked) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}
