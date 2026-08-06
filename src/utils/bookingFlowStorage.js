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

export function clearBookingDraft() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(BOOKING_DRAFT_KEY);
}
