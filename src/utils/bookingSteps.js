// The order of the booking wizard and what each step needs before it can
// be shown, in one place. Pages, the stepper and every "Book" button use
// these instead of hard-coding the next URL, so the order only lives here.
// Kept free of React/DOM imports so it can be unit tested with
// `node --test` (see bookingSteps.test.js).
//
//   Normal puja:  Puja -> Address -> Date & Time -> Pandit Ji -> Payment -> Confirmation
//   Package puja: Puja -> Address -> Date & Time -> Requirements -> Submitted

export const BOOKING_PATHS = {
  choosePuja: "/book",
  address: "/book/address",
  datetime: "/book/datetime",
  pandit: "/book/select-pandit",
  payment: "/book/payment",
  packageDetails: "/book/package/details",
};

// Where every "Book this puja" button starts the wizard.
export const BOOKING_START_PATH = BOOKING_PATHS.address;

const NORMAL_FLOW = ["address", "datetime", "pandit", "payment"];
const PACKAGE_FLOW = ["address", "datetime", "packageDetails"];

export function isPackagePuja(puja) {
  return puja?.pujaType === "package";
}

export function flowFor(puja) {
  return isPackagePuja(puja) ? PACKAGE_FLOW : NORMAL_FLOW;
}

// URL of the step after `step` for this puja, or null at the end.
export function nextStepPath(step, puja) {
  const flow = flowFor(puja);
  const index = flow.indexOf(step);
  if (index === -1 || index === flow.length - 1) return null;
  return BOOKING_PATHS[flow[index + 1]];
}

// Button label for moving on from `step`, e.g. "Next: Date & Time".
const STEP_TITLES = {
  address: "Address",
  datetime: "Date & Time",
  pandit: "Select Pandit",
  payment: "Payment",
  packageDetails: "Requirements",
};

export function nextStepLabel(step, puja) {
  const flow = flowFor(puja);
  const next = flow[flow.indexOf(step) + 1];
  return next ? `Next: ${STEP_TITLES[next]}` : "Next";
}

// 1-based position for BookingStepper ("Puja" is step 1 in both flows).
export function stepNumber(step, puja) {
  const index = flowFor(puja).indexOf(step);
  return index === -1 ? 1 : index + 2;
}

// What has to be filled in before each step can be shown.
function hasPuja(data) {
  return Boolean(data?.puja?.id);
}
function hasAddress(data) {
  return Boolean(data?.address && (data.address.address || data.address.savedAddressId) && data.address.city);
}
function hasDateTime(data) {
  return Boolean(data?.date && data?.slot);
}
function hasPandit(data) {
  return Boolean(data?.pandit?.id);
}

const REQUIREMENTS = {
  address: [],
  datetime: ["address"],
  pandit: ["address", "datetime"],
  payment: ["address", "datetime", "pandit"],
  packageDetails: ["address", "datetime"],
};

const CHECKS = { address: hasAddress, datetime: hasDateTime, pandit: hasPandit };

// null when `step` can be shown; otherwise the URL of the earliest step
// still to complete (the puja list when no puja was chosen at all).
export function missingStepPath(step, data) {
  if (!hasPuja(data)) return BOOKING_PATHS.choosePuja;
  if (step === "packageDetails" && !isPackagePuja(data.puja)) return BOOKING_PATHS.choosePuja;
  if (step === "pandit" || step === "payment") {
    if (isPackagePuja(data.puja)) return BOOKING_PATHS.choosePuja;
  }
  for (const required of REQUIREMENTS[step] || []) {
    if (!CHECKS[required](data)) return BOOKING_PATHS[required];
  }
  return null;
}

// Router state wins over the saved draft, field by field -- state only
// carries what the previous step passed along, the draft has the rest
// (e.g. after a refresh or a trip through /login).
export function resolveBookingData(state, draft) {
  const merged = { ...(draft || {}) };
  for (const [key, value] of Object.entries(state || {})) {
    if (value !== undefined && value !== null) merged[key] = value;
  }
  return merged;
}

// Draft for a brand-new booking of `puja`: drops the previous booking's
// date, slot and Pandit Ji (they belonged to another puja), keeps the
// last address so the address step can pre-select it.
export function freshBookingDraft(puja, previousDraft, extra = {}) {
  const draft = { puja, ...extra };
  if (previousDraft?.address) draft.address = previousDraft.address;
  return draft;
}
