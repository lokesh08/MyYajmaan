// Whether a Pandit Ji can take a given date + time slot, and their next
// free one -- for a booking started from the Pandit Ji's own page, where
// the wizard pre-picks a date & time that suits them. Works off the
// schedule from GET /pandits/{id}/schedule (weekly availability pattern
// + slots already held by bookings) and the same slot list the Date &
// Time step shows. Kept free of React/DOM imports so it can be unit
// tested with `node --test` (see panditAvailability.test.js).
//
// Mirrors the server's _pandit_matches_availability (routers/pandits.py):
// no pattern set yet = available any time.

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]; // Date#getDay order

// "07:00 PM" -> "19:00"; null when it isn't in that format.
export function slotTo24h(time) {
  const match = String(time || "").trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hours = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") hours += 12;
  return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

function weekdayKey(dateStr) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  if (!y || !m || !d) return null;
  return WEEKDAY_KEYS[new Date(y, m - 1, d).getDay()];
}

export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const next = new Date(y, m - 1, d + days);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}

// Local Date for a "YYYY-MM-DD" + "07:00 PM" pair.
export function slotDateTime(dateStr, time) {
  const hhmm = slotTo24h(time);
  const [y, m, d] = String(dateStr || "").split("-").map(Number);
  if (!hhmm || !y || !m || !d) return null;
  const [hours, minutes] = hhmm.split(":").map(Number);
  return new Date(y, m - 1, d, hours, minutes, 0, 0);
}

function isBooked(schedule, dateStr, time) {
  const hhmm = slotTo24h(time);
  return (schedule?.booked || []).some(
    (b) => b.date === dateStr && (b.timeslot === time || (hhmm && slotTo24h(b.timeslot) === hhmm)),
  );
}

// Does this Pandit Ji work at `time` on `dateStr`, with nothing booked then?
export function isPanditAvailable(schedule, dateStr, time) {
  if (!schedule || !dateStr || !time) return false;
  if (isBooked(schedule, dateStr, time)) return false;

  const pattern = schedule.availability_pattern || {};
  const { days, start_time: start, end_time: end } = pattern;
  if (!days?.length || !start || !end) return true;

  if (!days.includes(weekdayKey(dateStr))) return false;
  const hhmm = slotTo24h(time);
  if (!hhmm) return false;
  return start <= hhmm && hhmm < end;
}

// The availability service's { morning: [...], evening: [...] } as one
// list in time order.
export function flattenSlots(groups) {
  return Object.values(groups || {})
    .flat()
    .filter((slot) => slot && slot.time)
    .sort((a, b) => (slotTo24h(a.time) || "").localeCompare(slotTo24h(b.time) || ""));
}

// Earliest { date, slot } from `fromDate` on that the Pandit Ji is free
// for, is an open slot, and is at least `minLeadHours` away from `now`.
// null when there's nothing within `maxDays`.
export function findNextAvailableSlot(schedule, slots, { fromDate, now = new Date(), minLeadHours = 0, maxDays = 60 } = {}) {
  const ordered = flattenSlots(Array.isArray(slots) ? { all: slots } : slots).filter((slot) => slot.available !== false);
  if (!schedule || !fromDate || ordered.length === 0) return null;

  const earliest = new Date(now.getTime() + minLeadHours * 3600 * 1000);
  for (let offset = 0; offset < maxDays; offset += 1) {
    const date = addDays(fromDate, offset);
    for (const slot of ordered) {
      const when = slotDateTime(date, slot.time);
      if (!when || when < earliest) continue;
      if (isPanditAvailable(schedule, date, slot.time)) return { date, slot };
    }
  }
  return null;
}

// PIN codes compared the way people type them: spaces ignored.
export function samePincode(a, b) {
  const clean = (value) => String(value || "").replace(/\s+/g, "");
  return Boolean(clean(a)) && clean(a) === clean(b);
}
