import { freshBookingDraft } from './bookingSteps.js';

const BOOKING_DRAFT_KEY = 'myyajmaan-booking-draft';

export function getBookingDraft() {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.sessionStorage.getItem(BOOKING_DRAFT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveBookingDraft(partialDraft) {
  if (typeof window === 'undefined') return;

  const current = getBookingDraft();
  const next = { ...current, ...partialDraft };
  window.sessionStorage.setItem(BOOKING_DRAFT_KEY, JSON.stringify(next));
}

// Starts a new booking of `puja`: a fresh draft (see freshBookingDraft --
// keeps only the last address) saved before navigating, so the puja
// survives a redirect through /login for a logged-out visitor.
export function startBookingDraft(puja, extra = {}) {
  if (typeof window === 'undefined') return;
  const next = freshBookingDraft(puja, getBookingDraft(), extra);
  try {
    window.sessionStorage.setItem(BOOKING_DRAFT_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked -- router state still carries the puja */
  }
}

export function clearBookingDraft() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(BOOKING_DRAFT_KEY);
}
