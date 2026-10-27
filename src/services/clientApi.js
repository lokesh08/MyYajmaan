import { del, get, patch, post, put } from "../api";

const MULTIPART_CONFIG = { headers: { "Content-Type": undefined } };

// --- Profile & Settings ---

export function getMyProfile() {
  return get("/me/profile");
}

export function saveMyProfile(payload) {
  return put("/me/profile", payload);
}

export function changeMyPassword(currentPassword, newPassword) {
  return post("/me/change-password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

// --- Addresses ---

export function listCities() {
  return get("/cities");
}

export function listMyAddresses() {
  return get("/me/addresses");
}

export function addMyAddress(payload) {
  return post("/me/addresses", payload);
}

export function updateMyAddress(addressId, payload) {
  return patch(`/me/addresses/${addressId}`, payload);
}

export function setDefaultAddress(addressId) {
  return patch(`/me/addresses/${addressId}/default`, {});
}

export function deleteMyAddress(addressId) {
  return del(`/me/addresses/${addressId}`);
}

// --- Bookings ---

export function listMyClientBookings({ tab = "upcoming", page = 1, pageSize = 10 }) {
  return get("/me/bookings", { params: { tab, page, page_size: pageSize } });
}

export function getMyBookingCounts() {
  return get("/me/bookings/counts");
}

export function getMyBookingDetail(bookingId) {
  return get(`/me/bookings/${bookingId}`);
}

// Plain backend URL, not an axios call -- the browser's own HttpOnly
// auth cookie authenticates it (same pattern as adminApi.js's
// getReportsExportUrl), so this can be used directly as an <a href>.
export function getMyBookingInvoiceUrl(bookingId) {
  const baseURL = import.meta.env.VITE_API_BASE_URL || "";
  return `${baseURL}/me/bookings/${bookingId}/invoice`;
}

export function rescheduleMyBooking(bookingId, date, timeslot) {
  return patch(`/me/bookings/${bookingId}/reschedule`, { date, timeslot });
}

export function cancelMyBooking(bookingId, reason) {
  return patch(`/me/bookings/${bookingId}/cancel`, { reason: reason || undefined });
}

// --- Wallet ---

export function getMyClientWallet({ page = 1, pageSize = 20 }) {
  return get("/me/wallet", { params: { page, page_size: pageSize } });
}

export function topupMyWallet(amount, paymentRef) {
  return post("/me/wallet/topup", { amount, payment_ref: paymentRef || undefined });
}

// --- Refer & Earn ---

export function getReferralSummary() {
  return get("/referral");
}

// --- Feedback / Reviews ---

export function submitReview({ bookingId, rating, comment, pujaTitle, photos }) {
  const formData = new FormData();
  formData.append("booking_id", bookingId);
  formData.append("rating", rating);
  if (comment) formData.append("comment", comment);
  if (pujaTitle) formData.append("puja_title", pujaTitle);
  (photos || []).forEach((file) => formData.append("photos", file));
  return post("/reviews", formData, MULTIPART_CONFIG);
}
