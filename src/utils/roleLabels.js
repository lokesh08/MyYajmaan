// User-facing display label for an account role. "user" (the plain
// customer role) reads as "Yajmaan" everywhere in the UI instead of
// the raw role string; other roles just get capitalized.
const ROLE_LABELS = {
  user: "Yajmaan",
  pandit: "Pandit Ji",
  admin: "Admin",
};

export function formatRoleLabel(role) {
  if (!role) return "";
  return ROLE_LABELS[role] || role.charAt(0).toUpperCase() + role.slice(1);
}
