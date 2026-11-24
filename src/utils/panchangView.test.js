// Run with: npm run test:unit
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_PANCHANG_CITY,
  chooseInitialCity,
  endsNextDay,
  formatPanchangSpan,
  formatPanchangTime,
  isNowIn,
  pickChoghadiya,
} from "./panchangView.js";

// Tuesday 24 Nov 2026, Jaipur (from GET /panchang)
const DAY = [
  { name: "Rog", quality: "bad", start: "2026-11-24T06:53+05:30", end: "2026-11-24T08:13+05:30" },
  { name: "Udveg", quality: "bad", start: "2026-11-24T08:13+05:30", end: "2026-11-24T09:33+05:30" },
  { name: "Chal", quality: "neutral", start: "2026-11-24T09:33+05:30", end: "2026-11-24T10:53+05:30" },
  { name: "Labh", quality: "good", start: "2026-11-24T10:53+05:30", end: "2026-11-24T12:13+05:30" },
  { name: "Amrit", quality: "good", start: "2026-11-24T12:13+05:30", end: "2026-11-24T13:33+05:30" },
  { name: "Kaal", quality: "bad", start: "2026-11-24T13:33+05:30", end: "2026-11-24T14:53+05:30" },
  { name: "Shubh", quality: "good", start: "2026-11-24T14:53+05:30", end: "2026-11-24T16:13+05:30" },
  { name: "Rog", quality: "bad", start: "2026-11-24T16:13+05:30", end: "2026-11-24T17:34+05:30" },
];
const NIGHT = [
  { name: "Kaal", quality: "bad", start: "2026-11-24T17:34+05:30", end: "2026-11-24T19:14+05:30" },
  { name: "Labh", quality: "good", start: "2026-11-24T19:14+05:30", end: "2026-11-24T20:54+05:30" },
  { name: "Udveg", quality: "bad", start: "2026-11-24T20:54+05:30", end: "2026-11-24T22:34+05:30" },
  { name: "Shubh", quality: "good", start: "2026-11-24T22:34+05:30", end: "2026-11-25T00:14+05:30" },
];
const RAHU = { start: "2026-11-24T14:53+05:30", end: "2026-11-24T16:13+05:30" };
const at = (hhmm, day = "2026-11-24") => Date.parse(`${day}T${hhmm}+05:30`);

test("times are shown as IST 12-hour clock", () => {
  assert.equal(formatPanchangTime("2026-11-24T06:53+05:30"), "6:53 AM");
  assert.equal(formatPanchangTime("2026-11-24T12:05+05:30"), "12:05 PM");
  assert.equal(formatPanchangTime("2026-11-24T00:15+05:30"), "12:15 AM");
  assert.equal(formatPanchangTime("2026-11-24T23:59+05:30"), "11:59 PM");
  assert.equal(formatPanchangTime(null), "");
  assert.equal(formatPanchangSpan(RAHU), "2:53 PM – 4:13 PM");
  assert.equal(formatPanchangSpan(null), "");
});

test("ends-next-day flag", () => {
  assert.equal(endsNextDay("2026-11-25T02:10+05:30", "2026-11-24"), true);
  assert.equal(endsNextDay("2026-11-24T20:23+05:30", "2026-11-24"), false);
  assert.equal(endsNextDay(null, "2026-11-24"), false);
});

test("featured choghadiya: the auspicious one running now", () => {
  const pick = pickChoghadiya(DAY, at("12:30"));
  assert.equal(pick.name, "Amrit");
  assert.equal(pick.isNow, true);
});

test("featured choghadiya: else the next auspicious one", () => {
  const pick = pickChoghadiya(DAY, at("07:00"));
  assert.equal(pick.name, "Labh");
  assert.equal(pick.isNow, false);
});

test("a choghadiya that clashes with Rahu Kaal is skipped", () => {
  // Tuesday's Shubh is exactly Rahu Kaal
  assert.equal(pickChoghadiya(DAY, at("14:00")).name, "Shubh");
  const pick = pickChoghadiya([...DAY, ...NIGHT], at("14:00"), [RAHU]);
  assert.equal(pick.name, "Labh");
  assert.equal(pick.start, "2026-11-24T19:14+05:30");
});

test("after sunset the night choghadiya is used, across midnight too", () => {
  assert.equal(pickChoghadiya([...DAY, ...NIGHT], at("19:30"), [RAHU]).isNow, true);
  const late = pickChoghadiya([...DAY, ...NIGHT], at("23:50"), [RAHU]);
  assert.equal(late.name, "Shubh");
  assert.equal(late.isNow, true);
});

test("nothing left today -> the last auspicious one", () => {
  const pick = pickChoghadiya(DAY, at("18:00"));
  assert.equal(pick.name, "Shubh");
  assert.equal(pick.isNow, false);
});

test("no data -> nothing to feature", () => {
  assert.equal(pickChoghadiya([], at("10:00")), null);
  assert.equal(pickChoghadiya(undefined, at("10:00")), null);
  assert.equal(pickChoghadiya(DAY.filter((d) => d.quality !== "good"), at("10:00")), null);
  assert.equal(pickChoghadiya(DAY, at("10:00"), [null, undefined]).name, "Labh");
});

test("is now inside Rahu Kaal", () => {
  assert.equal(isNowIn(RAHU, at("15:00")), true);
  assert.equal(isNowIn(RAHU, at("16:13")), false);
  assert.equal(isNowIn(RAHU, at("15:00", "2026-11-25")), false);
  assert.equal(isNowIn(null, at("15:00")), false);
});

test("initial city: remembered, then saved address, then Jaipur", () => {
  const known = ["Jaipur", "Mumbai", "Ajmer"];
  assert.equal(chooseInitialCity({ stored: "Mumbai", addressCity: "Ajmer", known }), "Mumbai");
  assert.equal(chooseInitialCity({ stored: null, addressCity: "ajmer", known }), "ajmer");
  assert.equal(chooseInitialCity({ stored: "Atlantis", addressCity: "Atlantis", known }), DEFAULT_PANCHANG_CITY);
  assert.equal(chooseInitialCity({}), DEFAULT_PANCHANG_CITY);
});
