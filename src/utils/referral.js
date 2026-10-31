// Referral link helpers shared by the Refer & Earn popup/page and the
// register page. Kept free of React/DOM imports so they can be unit
// tested with `node --test` (see referral.test.js).

export const REFERRAL_STORAGE_KEY = "myyajmaan-referral-code";

// Same rule the backend uses when looking a code up (strip + upper).
export function normalizeReferralCode(value) {
  const code = String(value || "").trim().toUpperCase();
  return /^[A-Z0-9_-]{3,40}$/.test(code) ? code : "";
}

// The link a friend opens: the register page with the code pre-filled.
export function buildReferralLink(code, origin) {
  const clean = normalizeReferralCode(code);
  if (!clean || !origin) return "";
  return `${String(origin).replace(/\/+$/, "")}/register?ref=${encodeURIComponent(clean)}`;
}

export function buildReferralShareText(code, link) {
  return `Join MyYajmaan to book trusted Pandit Ji for your puja! Sign up with my link${
    code ? ` (referral code ${code})` : ""
  } and get a welcome bonus: ${link}`;
}

// Code from the URL (?ref=), else one remembered from an earlier visit
// in this browser -- so a friend who opens the link, wanders to Login and
// comes back to Register is still counted as referred.
export function resolveReferralCode(searchParamValue, storage) {
  const fromUrl = normalizeReferralCode(searchParamValue);
  try {
    if (fromUrl) {
      storage?.setItem(REFERRAL_STORAGE_KEY, fromUrl);
      return fromUrl;
    }
    return normalizeReferralCode(storage?.getItem(REFERRAL_STORAGE_KEY));
  } catch {
    return fromUrl;
  }
}

export function clearStoredReferralCode(storage) {
  try {
    storage?.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    /* storage blocked -- nothing to clear */
  }
}
