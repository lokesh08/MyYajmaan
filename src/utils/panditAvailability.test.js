// Run with: npm run test:unit
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  addDays,
  findNextAvailableSlot,
  flattenSlots,
  isPanditAvailable,
  samePincode,
  slotTo24h,
} from "./panditAvailability.js";

const SLOTS = {
  morning: [
    { id: "m1", time: "06:00 AM", available: true },
    { id: "m2", time: "07:00 AM", available: true },
  ],
  afternoon: [{ id: "a1", time: "12:00 PM", available: true }],
  evening: [
    { id: "e1", time: "06:00 PM", available: true },
    { id: "e2", time: "07:00 PM", available: true },
  ],
};

// 2026-11-27 is a Friday; 28th Saturday, 29th Sunday.
const WEEKEND_EVENINGS = {
  availability_pattern: { days: ["sat", "sun"], start_time: "17:00", end_time: "21:00" },
  booked: [],
};

test("slot times convert to 24h", () => {
  assert.equal(slotTo24h("07:00 AM"), "07:00");
  assert.equal(slotTo24h("12:00 PM"), "12:00");
  assert.equal(slotTo24h("12:30 AM"), "00:30");
  assert.equal(slotTo24h("08:00 pm"), "20:00");
  assert.equal(slotTo24h("soon"), null);
});

test("addDays crosses month and year ends", () => {
  assert.equal(addDays("2026-11-30", 1), "2026-12-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("pattern days and hours decide availability", () => {
  assert.equal(isPanditAvailable(WEEKEND_EVENINGS, "2026-11-28", "06:00 PM"), true);
  assert.equal(isPanditAvailable(WEEKEND_EVENINGS, "2026-11-28", "07:00 AM"), false); // wrong hour
  assert.equal(isPanditAvailable(WEEKEND_EVENINGS, "2026-11-27", "06:00 PM"), false); // Friday
  // end_time is exclusive, like the server
  const until6 = { availability_pattern: { days: ["sat"], start_time: "17:00", end_time: "18:00" } };
  assert.equal(isPanditAvailable(until6, "2026-11-28", "06:00 PM"), false);
});

test("no pattern set means always available", () => {
  assert.equal(isPanditAvailable({ availability_pattern: {} }, "2026-11-27", "06:00 AM"), true);
});

test("a booked slot is not available", () => {
  const schedule = { ...WEEKEND_EVENINGS, booked: [{ date: "2026-11-28", timeslot: "06:00 PM" }] };
  assert.equal(isPanditAvailable(schedule, "2026-11-28", "06:00 PM"), false);
  assert.equal(isPanditAvailable(schedule, "2026-11-28", "07:00 PM"), true);
});

test("next available slot skips to the Pandit Ji's first free day and time", () => {
  const next = findNextAvailableSlot(WEEKEND_EVENINGS, SLOTS, {
    fromDate: "2026-11-27",
    now: new Date(2026, 10, 27, 9, 0),
  });
  assert.equal(next.date, "2026-11-28");
  assert.equal(next.slot.id, "e1");
});

test("next available slot respects lead time and bookings", () => {
  const schedule = { ...WEEKEND_EVENINGS, booked: [{ date: "2026-11-28", timeslot: "07:00 PM" }] };
  // Saturday 5:30 PM with 1h notice: 6 PM too soon, 7 PM booked -> Sunday 6 PM
  const next = findNextAvailableSlot(schedule, SLOTS, {
    fromDate: "2026-11-28",
    now: new Date(2026, 10, 28, 17, 30),
    minLeadHours: 1,
  });
  assert.deepEqual([next.date, next.slot.id], ["2026-11-29", "e1"]);
});

test("next available slot is null when nothing fits", () => {
  const never = { availability_pattern: { days: ["mon"], start_time: "01:00", end_time: "02:00" } };
  assert.equal(findNextAvailableSlot(never, SLOTS, { fromDate: "2026-11-27", maxDays: 14 }), null);
  assert.equal(findNextAvailableSlot(WEEKEND_EVENINGS, {}, { fromDate: "2026-11-27" }), null);
});

test("closed slots are never picked", () => {
  const slots = { evening: [{ id: "e1", time: "06:00 PM", available: false }, { id: "e2", time: "07:00 PM", available: true }] };
  const next = findNextAvailableSlot(WEEKEND_EVENINGS, slots, { fromDate: "2026-11-28", now: new Date(2026, 10, 27) });
  assert.equal(next.slot.id, "e2");
});

test("slots flatten in time order", () => {
  assert.deepEqual(flattenSlots(SLOTS).map((s) => s.id), ["m1", "m2", "a1", "e1", "e2"]);
});

test("PIN codes compare ignoring spaces", () => {
  assert.equal(samePincode("305 001", "305001"), true);
  assert.equal(samePincode("305001", "305002"), false);
  assert.equal(samePincode("", ""), false);
});
