import { ADMIN_LOGIN_PATH } from "../constants/adminRoutes";

// Each role has its own dedicated login screen — admin and Pandit Ji
// accounts must never be sent to the customer /login page (or vice
// versa) after logging out, or when another tab's sign-in/out forces
// this tab's session to end.
export function getLoginPathForRole(role) {
  if (role === "admin") return ADMIN_LOGIN_PATH;
  if (role === "pandit") return "/pandit/login";
  return "/login";
}
