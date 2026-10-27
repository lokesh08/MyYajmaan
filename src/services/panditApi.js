import { del, get, patch, post, put } from "../api";

// Multipart requests: leave Content-Type unset so the browser sets
// the correct boundary itself (same pattern as adminApi.js).
const MULTIPART_CONFIG = { headers: { "Content-Type": undefined } };

// --- Onboarding status ---

export function getPanditStatus() {
  return get("/pandit/me/status");
}

// --- Basic profile ---

export function getPanditProfile() {
  return get("/pandit/me/profile");
}

export function savePanditProfile(payload) {
  return put("/pandit/me/profile", payload);
}

export function savePanditAvailability(payload) {
  return put("/pandit/me/availability", payload);
}

// --- Documents ---

export function getPanditDocuments() {
  return get("/pandit/me/documents");
}

export function savePanditDocuments({ aadharFront, aadharBack, photo }) {
  const formData = new FormData();
  if (aadharFront) formData.append("aadhar_front", aadharFront);
  if (aadharBack) formData.append("aadhar_back", aadharBack);
  if (photo) formData.append("photo", photo);
  return put("/pandit/me/documents", formData, MULTIPART_CONFIG);
}

// --- Aadhaar verification ---
// See myyajmaan-api/routers/pandit_aadhar.py -- mock mode until a
// licensed provider is configured (send-otp's response includes a
// debug_otp field only in that mode).

export function getAadharStatus() {
  return get("/pandit/me/aadhar/status");
}

export function sendAadharOtp(aadharNumber) {
  return post("/pandit/me/aadhar/send-otp", { aadhar_number: aadharNumber });
}

export function verifyAadharOtp(otp) {
  return post("/pandit/me/aadhar/verify-otp", { otp });
}

export function recheckAadharMatch() {
  return post("/pandit/me/aadhar/recheck", {});
}

export function fixAadharIdentity({ fullName, phone }) {
  return patch("/pandit/me/aadhar/fix-identity", {
    full_name: fullName || undefined,
    phone: phone || undefined,
  });
}

// --- Bank details ---

export function getPanditBankDetails() {
  return get("/pandit/me/bank-details");
}

export function savePanditBankDetails(payload) {
  return put("/pandit/me/bank-details", payload);
}

// --- My Pujas ---

export function listMyPujas() {
  return get("/pandit/me/pujas");
}

export function addMyPujas(pujas) {
  return post("/pandit/me/pujas", { pujas });
}

export function updateMyPuja(panditPujaId, payload) {
  return patch(`/pandit/me/pujas/${panditPujaId}`, payload);
}

export function removeMyPuja(panditPujaId) {
  return del(`/pandit/me/pujas/${panditPujaId}`);
}

export function listPublicPujas(limit = 100) {
  return get("/pujas", { params: { limit } });
}

// --- Manage Bookings ---

export function listMyBookings({ tab = "upcoming", page = 1, pageSize = 10 }) {
  return get("/pandit/me/bookings", { params: { tab, page, page_size: pageSize } });
}

export function getMyBookingTabCounts() {
  return get("/pandit/me/bookings/counts");
}

export function listMyDeclinedHistory({ page = 1, pageSize = 20 }) {
  return get("/pandit/me/bookings/declined-history", { params: { page, page_size: pageSize } });
}

export function respondToBooking(bookingId, action, reason) {
  return patch(`/pandit/me/bookings/${bookingId}/respond`, { action, reason: reason || undefined });
}

export function completeBooking(bookingId) {
  return patch(`/pandit/me/bookings/${bookingId}/complete`, {});
}

// Plain backend URL, not an axios call -- authenticated via the
// browser's own HttpOnly cookie, usable directly as an <a href>.
export function getMyBookingInvoiceUrl(bookingId) {
  const baseURL = import.meta.env.VITE_API_BASE_URL || "";
  return `${baseURL}/pandit/me/bookings/${bookingId}/invoice`;
}

// --- Upload Photos ---

export function listBookingPhotos(bookingId) {
  return get(`/pandit/me/bookings/${bookingId}/photos`);
}

export function uploadBookingPhotos(bookingId, files) {
  const formData = new FormData();
  Array.from(files).forEach((file) => formData.append("files", file));
  return post(`/pandit/me/bookings/${bookingId}/photos`, formData, MULTIPART_CONFIG);
}

// --- Feedback for Admin ---

export function listMyFeedback({ page = 1, pageSize = 20 }) {
  return get("/pandit/me/feedback", { params: { page, page_size: pageSize } });
}

export function submitFeedback(payload) {
  return post("/pandit/me/feedback", payload);
}

// --- My Wallet ---

export function getMyWallet({ page = 1, pageSize = 20 }) {
  return get("/pandit/me/wallet", { params: { page, page_size: pageSize } });
}

export function requestWithdrawal(amount) {
  return post("/pandit/me/wallet/withdraw", { amount });
}
