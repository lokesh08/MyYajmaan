// Display helpers for the Panchang card (GET /panchang). Times arrive as
// ISO strings in IST ("2026-11-24T06:53+05:30"); the app serves India,
// so they are shown as written, never converted to the viewer's zone.
// No React/DOM imports, so it is unit tested with `node --test`.

export const PANCHANG_CITY_KEY = "myyajmaan-panchang-city";
export const DEFAULT_PANCHANG_CITY = "Jaipur";

// "2026-11-24T14:53+05:30" -> "2:53 PM"
export function formatPanchangTime(iso) {
  const match = /T(\d{2}):(\d{2})/.exec(String(iso || ""));
  if (!match) return "";
  const hours = Number(match[1]);
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${match[2]} ${suffix}`;
}

export function formatPanchangSpan(span) {
  if (!span?.start || !span?.end) return "";
  return `${formatPanchangTime(span.start)} – ${formatPanchangTime(span.end)}`;
}

// Is an "ends at" moment on a later calendar day than the panchang date?
export function endsNextDay(iso, panchangDate) {
  return Boolean(iso && panchangDate && String(iso).slice(0, 10) > panchangDate);
}

function ms(iso) {
  const value = Date.parse(iso || "");
  return Number.isNaN(value) ? null : value;
}

function overlaps(part, span) {
  const [a, b, c, d] = [ms(part.start), ms(part.end), ms(span?.start), ms(span?.end)];
  return a != null && b != null && c != null && d != null && a < d && c < b;
}

// The Choghadiya to feature: an auspicious one (Amrit/Shubh/Labh) that
// doesn't clash with Rahu Kaal etc. (`avoid`) -- the one running now,
// else the next one (day, then night), else the last of the day.
// `isNow` tells the card to say "now" instead of a time.
export function pickChoghadiya(parts, nowMs, avoid = []) {
  if (!Array.isArray(parts) || !parts.length) return null;
  const good = parts.filter((p) => p.quality === "good" && !avoid.some((span) => overlaps(p, span)));
  if (!good.length) return null;
  const current = good.find((p) => ms(p.start) <= nowMs && nowMs < ms(p.end));
  if (current) return { ...current, isNow: true };
  const next = good.find((p) => ms(p.start) > nowMs);
  return { ...(next || good[good.length - 1]), isNow: false };
}

// Is "now" inside a span (Rahu Kaal etc.)?
export function isNowIn(span, nowMs) {
  const start = ms(span?.start);
  const end = ms(span?.end);
  return start != null && end != null && start <= nowMs && nowMs < end;
}

// City to show: remembered choice, else the visitor's saved default
// address, else Jaipur -- only if we have coordinates for it.
export function chooseInitialCity({ stored, addressCity, known }) {
  const isKnown = (name) => Boolean(name) && (!known || known.some((c) => c.toLowerCase() === String(name).toLowerCase()));
  if (isKnown(stored)) return stored;
  if (isKnown(addressCity)) return addressCity;
  return DEFAULT_PANCHANG_CITY;
}
