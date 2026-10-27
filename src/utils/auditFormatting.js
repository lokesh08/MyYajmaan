// src/utils/auditFormatting.js
//
// Turns raw audit_logs rows (action="ADMIN_PUJA_CREATED", entity=
// "pujas", payload={...}) into plain-English labels, an icon/color
// category, and a one-line description built from the payload —
// so the Audit Log screen reads like a activity feed instead of a
// dump of internal action codes.

const CATEGORY_META = {
  create: { icon: "➕", badge: "bg-emerald-100 text-emerald-700" },
  update: { icon: "✏️", badge: "bg-sky-100 text-sky-700" },
  delete: { icon: "🗑️", badge: "bg-rose-100 text-rose-700" },
  approve: { icon: "✅", badge: "bg-emerald-100 text-emerald-700" },
  reject: { icon: "🚫", badge: "bg-rose-100 text-rose-700" },
  auth: { icon: "🔐", badge: "bg-indigo-100 text-indigo-700" },
  security: { icon: "⚠️", badge: "bg-amber-100 text-amber-700" },
  finance: { icon: "💰", badge: "bg-amber-100 text-amber-700" },
  view: { icon: "👁️", badge: "bg-slate-100 text-slate-600" },
  export: { icon: "📤", badge: "bg-teal-100 text-teal-700" },
  other: { icon: "📋", badge: "bg-slate-100 text-slate-600" },
};

// Every action string this app actually writes to audit_logs, with a
// plain-English label and a category for the icon/color. Add new
// actions here as they're introduced — anything missing still shows
// sensibly via the fallback humanizer below, just without an icon.
const ACTION_META = {
  ADMIN_COUPON_CREATED: { label: "Coupon Created", category: "create" },
  ADMIN_COUPON_UPDATED: { label: "Coupon Updated", category: "update" },
  ADMIN_COUPON_DELETED: { label: "Coupon Deleted", category: "delete" },
  ADMIN_LOGIN: { label: "Admin Logged In", category: "auth" },
  ADMIN_LOGOUT: { label: "Admin Logged Out", category: "auth" },
  ADMIN_MUHURAT_CREATED: { label: "Shubh Muhurat Created", category: "create" },
  ADMIN_MUHURAT_UPDATED: { label: "Shubh Muhurat Updated", category: "update" },
  ADMIN_MUHURAT_DELETED: { label: "Shubh Muhurat Deleted", category: "delete" },
  ADMIN_PANDIT_APPROVED: { label: "Pandit Ji Approved", category: "approve" },
  ADMIN_PANDIT_REJECTED: { label: "Pandit Ji Rejected", category: "reject" },
  ADMIN_PASSWORD_CHANGED: { label: "Admin Password Changed", category: "security" },
  ADMIN_PUJA_CREATED: { label: "Puja Created", category: "create" },
  ADMIN_PUJA_UPDATED: { label: "Puja Updated", category: "update" },
  ADMIN_PUJA_STATUS_CHANGED: { label: "Puja Enabled/Disabled", category: "update" },
  ADMIN_PUJA_DELETED: { label: "Puja Deleted", category: "delete" },
  ADMIN_REPORTS_EXPORTED: { label: "Reports Exported", category: "export" },
  ADMIN_REVIEW_STATUS_CHANGED: { label: "Testimonial Status Changed", category: "update" },
  ADMIN_REVIEW_DELETED: { label: "Testimonial Deleted", category: "delete" },
  ADMIN_SUPPORT_STATUS_CHANGED: { label: "Support Request Updated", category: "update" },
  ADMIN_USERS_EXPORTED: { label: "Users List Exported", category: "export" },
  ADMIN_USER_STATUS_CHANGED: { label: "User Status Changed", category: "update" },
  AUTH_FORCED_LOGOUT: { label: "Previous Session Signed Out", category: "security" },
  AUTH_LOGIN: { label: "User Logged In", category: "auth" },
  AUTH_LOGIN_BLOCKED: { label: "Login Blocked", category: "security" },
  AUTH_LOGOUT: { label: "User Logged Out", category: "auth" },
  AUTH_REGISTER: { label: "New Account Registered", category: "create" },
  PANDIT_VIEWED: { label: "Pandit Ji Profile Viewed", category: "view" },
  PUJA_VIEWED: { label: "Puja Details Viewed", category: "view" },
  REFERRAL_SIGNUP_LINKED: { label: "Referral Signup Rewarded", category: "finance" },
  WALLET_CREDITED: { label: "Wallet Credited", category: "finance" },
  "contact_message.created": { label: "Contact Us Message Submitted", category: "create" },
};

const ENTITY_LABELS = {
  users: "Users",
  pandits: "Pandit Ji",
  pujas: "Pujas",
  coupons: "Coupons & Offers",
  muhrats: "Shubh Muhurat",
  reviews: "Testimonials",
  contact_messages: "Support Requests",
  bookings: "Bookings",
};

const WALLET_REASON_LABELS = {
  signup_bonus: "Signup bonus",
  referral_signup: "Referral signup reward",
  referral_first_booking: "Referral first-booking reward",
};

function humanizeActionCode(action) {
  if (!action) return "Unknown Action";
  return action
    .replace(/[._]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function describeAction(action) {
  const meta = ACTION_META[action];
  if (meta) return meta;
  return { label: humanizeActionCode(action), category: "other" };
}

export function describeEntity(entity) {
  if (!entity) return null;
  return ENTITY_LABELS[entity] || humanizeActionCode(entity);
}

export function getCategoryStyle(category) {
  return CATEGORY_META[category] || CATEGORY_META.other;
}

export function describePayload(action, payload) {
  const data = payload || {};
  const parts = [];

  const subject =
    data.title ||
    data.code ||
    data.pandit_name ||
    data.client_name ||
    data.name ||
    data.target_email ||
    data.email ||
    data.referred_email ||
    data.previous_email ||
    null;
  if (subject) parts.push(`"${subject}"`);

  if (data.old_status && data.new_status) {
    parts.push(`${humanizeActionCode(data.old_status)} → ${humanizeActionCode(data.new_status)}`);
  }
  if (typeof data.old_is_active === "boolean" && typeof data.new_is_active === "boolean") {
    parts.push(`${data.old_is_active ? "Active" : "Disabled"} → ${data.new_is_active ? "Active" : "Disabled"}`);
  }
  if (data.previous_email && data.new_email && data.previous_email !== subject) {
    parts.push(`${data.previous_email} → ${data.new_email}`);
  }

  if (action === "WALLET_CREDITED" && data.reason) {
    parts.push(WALLET_REASON_LABELS[data.reason] || humanizeActionCode(data.reason));
  }
  if (data.amount) parts.push(`₹${data.amount}`);
  if (data.reward_amount) parts.push(`₹${data.reward_amount} reward`);
  if (data.row_count !== undefined) parts.push(`${data.row_count} rows`);

  if (
    action !== "WALLET_CREDITED" &&
    typeof data.reason === "string" &&
    data.reason.length > 3 &&
    data.reason.includes(" ")
  ) {
    parts.push(`Reason: ${data.reason}`);
  }

  return parts.length > 0 ? parts.join(" · ") : "No additional details recorded.";
}

export function formatRelativeTime(isoString) {
  if (!isoString) return "-";
  const date = new Date(isoString);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? "s" : ""} ago`;
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function getKnownActions() {
  return Object.entries(ACTION_META).map(([value, meta]) => ({ value, label: meta.label }));
}

export function getKnownEntities() {
  return Object.entries(ENTITY_LABELS).map(([value, label]) => ({ value, label }));
}
