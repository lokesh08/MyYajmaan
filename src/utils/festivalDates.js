// Date check for festival-specific pujas (Holika Dahan, Diwali, Ganesh
// Chaturthi...). A puja's festival_name is matched to festival titles in
// the calendar (GET /festivals, upcoming only). If the customer picks a
// date outside every upcoming occurrence of that festival, the booking
// page shows a "different from the festival date" warning.
// Dates are "YYYY-MM-DD" strings (they compare correctly as text).
// No React/DOM imports, so it is unit tested with `node --test`.

export function normalizeFestivalName(name) {
  return String(name || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function lastDay(festival) {
  return festival.end_date || festival.start_date;
}

// Upcoming (not yet ended) calendar entries for this festival, soonest first.
export function festivalOccurrences(festivals, festivalName, today) {
  const wanted = normalizeFestivalName(festivalName);
  if (!wanted || !Array.isArray(festivals)) return [];
  return festivals
    .filter((f) => f && f.start_date && normalizeFestivalName(f.title) === wanted && lastDay(f) >= today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
}

export function isWithinFestival(date, festival) {
  return Boolean(date) && date >= festival.start_date && date <= lastDay(festival);
}

function daysBetween(a, b) {
  return Math.abs((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);
}

function distanceToFestival(date, festival) {
  if (isWithinFestival(date, festival)) return 0;
  return Math.min(daysBetween(date, festival.start_date), daysBetween(date, lastDay(festival)));
}

// The date to suggest for one calendar entry: its first day, or today if
// a multi-day festival is already under way.
export function recommendedDateFor(festival, today) {
  return festival.start_date >= today ? festival.start_date : today;
}

// First upcoming occurrence, for the "Recommended date" hint.
export function nextFestival(festivals, festivalName, today) {
  return festivalOccurrences(festivals, festivalName, today)[0] || null;
}

// null when no warning is needed (puja not festival-specific, festival not
// in the calendar yet, or the date falls on the festival). Otherwise the
// nearest occurrence and the date to suggest.
export function checkFestivalDate({ festivalName, festivals, selectedDate, today }) {
  if (!selectedDate) return null;
  const occurrences = festivalOccurrences(festivals, festivalName, today);
  if (!occurrences.length) return null;
  if (occurrences.some((f) => isWithinFestival(selectedDate, f))) return null;

  const nearest = occurrences.reduce((best, f) => (distanceToFestival(selectedDate, f) < distanceToFestival(selectedDate, best) ? f : best));
  return {
    festivalName: nearest.title,
    recommendedDate: recommendedDateFor(nearest, today),
    startDate: nearest.start_date,
    endDate: nearest.end_date || null,
  };
}

// Today's date as YYYY-MM-DD in the visitor's local time.
export function localToday(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
