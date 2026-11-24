// Run with: npm run test:unit
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  checkFestivalDate,
  festivalOccurrences,
  isWithinFestival,
  localToday,
  nextFestival,
  normalizeFestivalName,
  recommendedDateFor,
} from "./festivalDates.js";

const TODAY = "2026-11-24";
const CALENDAR = [
  { title: "Holika Dahan", start_date: "2027-03-21", end_date: null },
  { title: "Holi", start_date: "2027-03-22", end_date: null },
  { title: "Diwali", start_date: "2026-11-08", end_date: null }, // already passed
  { title: "Diwali", start_date: "2027-10-29", end_date: null },
  { title: "Sharad Navratri", start_date: "2027-10-01", end_date: "2027-10-09" },
  { title: "Ganesh Chaturthi", start_date: "2026-11-20", end_date: "2026-11-30" }, // under way
];

test("names match ignoring case and spaces", () => {
  assert.equal(normalizeFestivalName("  Holika   DAHAN "), "holika dahan");
  assert.equal(festivalOccurrences(CALENDAR, "holika dahan", TODAY).length, 1);
});

test("past occurrences are ignored, upcoming are soonest first", () => {
  const diwali = festivalOccurrences(CALENDAR, "Diwali", TODAY);
  assert.deepEqual(diwali.map((f) => f.start_date), ["2027-10-29"]);
  assert.equal(nextFestival(CALENDAR, "Diwali", TODAY).start_date, "2027-10-29");
  assert.equal(nextFestival(CALENDAR, "Janmashtami", TODAY), null);
});

test("no warning for pujas that are not festival-specific", () => {
  assert.equal(checkFestivalDate({ festivalName: null, festivals: CALENDAR, selectedDate: "2027-01-05", today: TODAY }), null);
  assert.equal(checkFestivalDate({ festivalName: "", festivals: CALENDAR, selectedDate: "2027-01-05", today: TODAY }), null);
});

test("no warning when the festival has no upcoming date in the calendar", () => {
  assert.equal(checkFestivalDate({ festivalName: "Janmashtami", festivals: CALENDAR, selectedDate: "2027-01-05", today: TODAY }), null);
  assert.equal(checkFestivalDate({ festivalName: "Diwali", festivals: [], selectedDate: "2027-01-05", today: TODAY }), null);
  assert.equal(checkFestivalDate({ festivalName: "Diwali", festivals: undefined, selectedDate: "2027-01-05", today: TODAY }), null);
});

test("no warning on the festival day", () => {
  assert.equal(checkFestivalDate({ festivalName: "Holika Dahan", festivals: CALENDAR, selectedDate: "2027-03-21", today: TODAY }), null);
});

test("warning on any other day, suggesting the festival day", () => {
  const w = checkFestivalDate({ festivalName: "Holika Dahan", festivals: CALENDAR, selectedDate: "2027-03-22", today: TODAY });
  assert.deepEqual(w, { festivalName: "Holika Dahan", recommendedDate: "2027-03-21", startDate: "2027-03-21", endDate: null });
  assert.ok(checkFestivalDate({ festivalName: "Holika Dahan", festivals: CALENDAR, selectedDate: "2026-12-01", today: TODAY }));
});

test("multi-day festivals accept every day in the range", () => {
  for (const d of ["2027-10-01", "2027-10-05", "2027-10-09"]) {
    assert.equal(checkFestivalDate({ festivalName: "Sharad Navratri", festivals: CALENDAR, selectedDate: d, today: TODAY }), null, d);
  }
  const w = checkFestivalDate({ festivalName: "Sharad Navratri", festivals: CALENDAR, selectedDate: "2027-10-10", today: TODAY });
  assert.equal(w.recommendedDate, "2027-10-01");
  assert.equal(w.endDate, "2027-10-09");
});

test("a festival already under way suggests today, not a past start date", () => {
  assert.equal(checkFestivalDate({ festivalName: "Ganesh Chaturthi", festivals: CALENDAR, selectedDate: "2026-11-26", today: TODAY }), null);
  const w = checkFestivalDate({ festivalName: "Ganesh Chaturthi", festivals: CALENDAR, selectedDate: "2026-12-05", today: TODAY });
  assert.equal(w.recommendedDate, TODAY);
});

test("with several upcoming dates, the nearest one is suggested", () => {
  const two = [
    { title: "Diwali", start_date: "2027-10-29", end_date: null },
    { title: "Diwali", start_date: "2028-10-17", end_date: null },
  ];
  assert.equal(checkFestivalDate({ festivalName: "Diwali", festivals: two, selectedDate: "2028-09-01", today: TODAY }).recommendedDate, "2028-10-17");
  assert.equal(checkFestivalDate({ festivalName: "Diwali", festivals: two, selectedDate: "2027-11-02", today: TODAY }).recommendedDate, "2027-10-29");
});

test("no date picked yet -> no warning", () => {
  assert.equal(checkFestivalDate({ festivalName: "Holi", festivals: CALENDAR, selectedDate: "", today: TODAY }), null);
});

test("helpers", () => {
  assert.equal(isWithinFestival("2027-10-03", CALENDAR[4]), true);
  assert.equal(isWithinFestival("", CALENDAR[4]), false);
  assert.equal(recommendedDateFor(CALENDAR[5], TODAY), TODAY);
  assert.equal(recommendedDateFor(CALENDAR[0], TODAY), "2027-03-21");
  assert.equal(localToday(new Date(2026, 0, 5)), "2026-01-05");
});
