// Run with: npm run test:unit
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  BOOKING_PATHS,
  BOOKING_START_PATH,
  flowFor,
  freshBookingDraft,
  missingStepPath,
  nextStepLabel,
  nextStepPath,
  resolveBookingData,
  stepNumber,
} from "./bookingSteps.js";

const NORMAL_PUJA = { id: "puja-1", title: "Sundarkand Path", pujaType: "normal" };
const PACKAGE_PUJA = { id: "puja-2", title: "Griha Pravesh Package", pujaType: "package" };
const SAVED_ADDRESS = { name: "Asmita", phone: "9999999999", address: "679 Kotra", city: "Ajmer", state: "Rajasthan", pin: "305001", savedAddressId: "addr-1" };
const TYPED_ADDRESS = { name: "Asmita", phone: "9999999999", address: "679 Kotra", city: "Ajmer", pin: "305001" };
const SLOT = { id: "s1", time: "07:00 AM" };
const PANDIT = { id: "pandit-1", name: "Lokesh Sharma", price: 1500 };

// ---------------------------------------------------------------------
// Order
// ---------------------------------------------------------------------

test("every booking starts at the address step", () => {
  assert.equal(BOOKING_START_PATH, "/book/address");
});

test("normal puja: address -> date & time -> pandit -> payment", () => {
  assert.deepEqual(flowFor(NORMAL_PUJA), ["address", "datetime", "pandit", "payment"]);
  assert.equal(nextStepPath("address", NORMAL_PUJA), "/book/datetime");
  assert.equal(nextStepPath("datetime", NORMAL_PUJA), "/book/select-pandit");
  assert.equal(nextStepPath("pandit", NORMAL_PUJA), "/book/payment");
  assert.equal(nextStepPath("payment", NORMAL_PUJA), null);
});

test("package puja: address -> date & time -> requirements", () => {
  assert.deepEqual(flowFor(PACKAGE_PUJA), ["address", "datetime", "packageDetails"]);
  assert.equal(nextStepPath("address", PACKAGE_PUJA), "/book/datetime");
  assert.equal(nextStepPath("datetime", PACKAGE_PUJA), "/book/package/details");
  assert.equal(nextStepPath("packageDetails", PACKAGE_PUJA), null);
});

test("a puja without a type is booked as a normal puja", () => {
  assert.equal(nextStepPath("datetime", { id: "x" }), "/book/select-pandit");
  assert.equal(nextStepPath("datetime", undefined), "/book/select-pandit");
});

test("next button labels follow the new order", () => {
  assert.equal(nextStepLabel("address", NORMAL_PUJA), "Next: Date & Time");
  assert.equal(nextStepLabel("datetime", NORMAL_PUJA), "Next: Select Pandit");
  assert.equal(nextStepLabel("pandit", NORMAL_PUJA), "Next: Payment");
  assert.equal(nextStepLabel("address", PACKAGE_PUJA), "Next: Date & Time");
  assert.equal(nextStepLabel("datetime", PACKAGE_PUJA), "Next: Requirements");
});

// The stepper's labels live in BookingStepper.jsx (JSX, not importable
// here); read them from the file so the two can't drift apart.
function stepperLabels(name) {
  const source = readFileSync(new URL("../components/BookingStepper.jsx", import.meta.url), "utf8");
  const block = source.match(new RegExp(`${name} = \\[([^\\]]*)\\]`))[1];
  return [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

test("stepper shows Address as step 2 and Date & Time as step 3", () => {
  const normal = stepperLabels("NORMAL_STEPS");
  assert.deepEqual(normal, ["Puja", "Address", "Date & Time", "Pandit", "Payment", "Confirmation"]);
  assert.equal(normal[stepNumber("address", NORMAL_PUJA) - 1], "Address");
  assert.equal(normal[stepNumber("datetime", NORMAL_PUJA) - 1], "Date & Time");
  assert.equal(normal[stepNumber("pandit", NORMAL_PUJA) - 1], "Pandit");
  assert.equal(normal[stepNumber("payment", NORMAL_PUJA) - 1], "Payment");

  const pkg = stepperLabels("PACKAGE_STEPS");
  assert.deepEqual(pkg, ["Puja", "Address", "Date & Time", "Requirements", "Submitted"]);
  assert.equal(pkg[stepNumber("address", PACKAGE_PUJA) - 1], "Address");
  assert.equal(pkg[stepNumber("datetime", PACKAGE_PUJA) - 1], "Date & Time");
  assert.equal(pkg[stepNumber("packageDetails", PACKAGE_PUJA) - 1], "Requirements");
});

// ---------------------------------------------------------------------
// Guards: opening a step without what it needs
// ---------------------------------------------------------------------

test("no puja chosen -> back to the puja list from any step", () => {
  for (const step of ["address", "datetime", "pandit", "payment", "packageDetails"]) {
    assert.equal(missingStepPath(step, {}), BOOKING_PATHS.choosePuja, step);
    assert.equal(missingStepPath(step, { address: SAVED_ADDRESS, date: "2026-11-05", slot: SLOT }), BOOKING_PATHS.choosePuja, step);
  }
});

test("address step only needs the puja", () => {
  assert.equal(missingStepPath("address", { puja: NORMAL_PUJA }), null);
  assert.equal(missingStepPath("address", { puja: PACKAGE_PUJA }), null);
});

test("date & time without an address (old link / bookmark) -> address step", () => {
  assert.equal(missingStepPath("datetime", { puja: NORMAL_PUJA }), "/book/address");
  assert.equal(missingStepPath("datetime", { puja: NORMAL_PUJA, address: { city: "Ajmer" } }), "/book/address");
  assert.equal(missingStepPath("datetime", { puja: NORMAL_PUJA, address: SAVED_ADDRESS }), null);
  // Typed-in address (when saved addresses couldn't load) counts too.
  assert.equal(missingStepPath("datetime", { puja: NORMAL_PUJA, address: TYPED_ADDRESS }), null);
});

test("pandit step needs address and date/time, earliest missing first", () => {
  assert.equal(missingStepPath("pandit", { puja: NORMAL_PUJA }), "/book/address");
  assert.equal(missingStepPath("pandit", { puja: NORMAL_PUJA, date: "2026-11-05", slot: SLOT }), "/book/address");
  assert.equal(missingStepPath("pandit", { puja: NORMAL_PUJA, address: SAVED_ADDRESS }), "/book/datetime");
  assert.equal(missingStepPath("pandit", { puja: NORMAL_PUJA, address: SAVED_ADDRESS, date: "2026-11-05" }), "/book/datetime");
  assert.equal(missingStepPath("pandit", { puja: NORMAL_PUJA, address: SAVED_ADDRESS, date: "2026-11-05", slot: SLOT }), null);
});

test("payment step also needs a Pandit Ji", () => {
  const data = { puja: NORMAL_PUJA, address: SAVED_ADDRESS, date: "2026-11-05", slot: SLOT };
  assert.equal(missingStepPath("payment", data), "/book/select-pandit");
  assert.equal(missingStepPath("payment", { ...data, pandit: PANDIT }), null);
});

test("package requirements need address and date/time", () => {
  assert.equal(missingStepPath("packageDetails", { puja: PACKAGE_PUJA }), "/book/address");
  assert.equal(missingStepPath("packageDetails", { puja: PACKAGE_PUJA, address: SAVED_ADDRESS }), "/book/datetime");
  assert.equal(missingStepPath("packageDetails", { puja: PACKAGE_PUJA, address: SAVED_ADDRESS, date: "2026-11-05", slot: SLOT }), null);
});

test("steps of the other flow are refused", () => {
  const ready = { address: SAVED_ADDRESS, date: "2026-11-05", slot: SLOT, pandit: PANDIT };
  assert.equal(missingStepPath("packageDetails", { ...ready, puja: NORMAL_PUJA }), "/book");
  assert.equal(missingStepPath("pandit", { ...ready, puja: PACKAGE_PUJA }), "/book");
  assert.equal(missingStepPath("payment", { ...ready, puja: PACKAGE_PUJA }), "/book");
});

// ---------------------------------------------------------------------
// Router state vs saved draft
// ---------------------------------------------------------------------

test("router state wins over the draft, field by field", () => {
  const draft = { puja: NORMAL_PUJA, address: SAVED_ADDRESS, date: "2026-11-05", slot: SLOT };
  const state = { puja: NORMAL_PUJA, address: { ...SAVED_ADDRESS, city: "Jaipur" } };
  const data = resolveBookingData(state, draft);
  assert.equal(data.address.city, "Jaipur");
  assert.equal(data.date, "2026-11-05"); // kept from the draft
  assert.deepEqual(data.slot, SLOT);
});

test("missing / empty state falls back to the draft (refresh, login redirect)", () => {
  const draft = { puja: NORMAL_PUJA, address: SAVED_ADDRESS };
  assert.deepEqual(resolveBookingData(null, draft), draft);
  assert.deepEqual(resolveBookingData(undefined, draft), draft);
  assert.deepEqual(resolveBookingData({ puja: undefined, address: null }, draft), draft);
  assert.deepEqual(resolveBookingData({}, {}), {});
  assert.deepEqual(resolveBookingData(null, null), {});
});

test("starting a new booking drops the old date, slot and Pandit Ji but keeps the address", () => {
  const old = { puja: NORMAL_PUJA, address: SAVED_ADDRESS, date: "2026-11-05", slot: SLOT, pandit: PANDIT, packageBooking: { id: "b1" } };
  const fresh = freshBookingDraft(PACKAGE_PUJA, old, { selectedPuja: { id: "puja-2" } });
  assert.deepEqual(fresh, { puja: PACKAGE_PUJA, selectedPuja: { id: "puja-2" }, address: SAVED_ADDRESS });
  assert.deepEqual(freshBookingDraft(NORMAL_PUJA, {}), { puja: NORMAL_PUJA });
  assert.deepEqual(freshBookingDraft(NORMAL_PUJA, null), { puja: NORMAL_PUJA });
});

// ---------------------------------------------------------------------
// Whole journeys, step by step, as the pages hand data along
// ---------------------------------------------------------------------

function walk(puja) {
  const visited = [];
  let draft = freshBookingDraft(puja, { address: SAVED_ADDRESS, date: "2020-01-01", slot: { id: "old" }, pandit: { id: "old" } });
  let path = BOOKING_START_PATH;
  let state = { puja };
  const pathToStep = Object.fromEntries(Object.entries(BOOKING_PATHS).map(([k, v]) => [v, k]));

  while (path) {
    const step = pathToStep[path];
    const data = resolveBookingData(state, draft);
    assert.equal(missingStepPath(step, data), null, `step ${step} should be reachable`);
    visited.push(step);
    // What each page adds before moving on.
    if (step === "address") Object.assign(data, { address: SAVED_ADDRESS });
    if (step === "datetime") {
      assert.equal(data.date, undefined, "an old booking's date must not be pre-filled");
      Object.assign(data, { date: "2026-11-05", slot: SLOT });
    }
    if (step === "pandit") Object.assign(data, { pandit: PANDIT });
    draft = { ...draft, ...data };
    state = data;
    path = nextStepPath(step, puja);
  }
  return visited;
}

test("full normal booking walks Address -> Date & Time -> Pandit -> Payment", () => {
  assert.deepEqual(walk(NORMAL_PUJA), ["address", "datetime", "pandit", "payment"]);
});

test("full package request walks Address -> Date & Time -> Requirements", () => {
  assert.deepEqual(walk(PACKAGE_PUJA), ["address", "datetime", "packageDetails"]);
});

test("going Back to change the address keeps the chosen date/slot", () => {
  // At date/time with everything chosen, user goes Back to address,
  // picks another address; the address step merges only puja+address.
  const draft = { puja: NORMAL_PUJA, address: SAVED_ADDRESS, date: "2026-11-05", slot: SLOT };
  const newAddress = { ...SAVED_ADDRESS, savedAddressId: "addr-2", city: "Jaipur" };
  const afterAddressStep = { ...draft, puja: NORMAL_PUJA, address: newAddress };
  const atDateTime = resolveBookingData({ puja: NORMAL_PUJA, address: newAddress }, afterAddressStep);
  assert.equal(atDateTime.address.city, "Jaipur");
  assert.equal(atDateTime.date, "2026-11-05");
  assert.deepEqual(atDateTime.slot, SLOT);
  assert.equal(missingStepPath("pandit", atDateTime), null);
});
