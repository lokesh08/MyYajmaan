import { del, get, patch, post, postForm, put } from "../api";

export function adminLogin(email, password) {
  return post("/admin/auth/login", { email, password });
}

export function adminMe() {
  return get("/admin/auth/me");
}

export function adminLogout() {
  return post("/admin/auth/logout", {});
}

export function listCmsContent() {
  return get("/admin/cms");
}

export function saveCmsContent(key, content) {
  return put(`/admin/cms/${key}`, { content });
}

export function getDashboardSummary() {
  return get("/admin/dashboard/summary");
}

export function getBookingsOverview(days = 7) {
  return get("/admin/dashboard/bookings-overview", { params: { days } });
}

export function getBookingsByStatus() {
  return get("/admin/dashboard/bookings-by-status");
}

export function getRecentBookings(limit = 5) {
  return get("/admin/dashboard/recent-bookings", { params: { limit } });
}

export function getTopPujas(limit = 5) {
  return get("/admin/dashboard/top-pujas", { params: { limit } });
}

export function listUsers({ status = "all", search = "", page = 1, pageSize = 10 }) {
  return get("/admin/users", {
    params: { status, search: search || undefined, page, page_size: pageSize },
  });
}

export function getUserStatusCounts(search = "") {
  return get("/admin/users/counts", {
    params: { search: search || undefined },
  });
}

export function getUserDetail(userId) {
  return get(`/admin/users/${userId}`);
}

export function updateUserStatus(userId, status, reason) {
  return patch(`/admin/users/${userId}/status`, { status, reason });
}

export function getUsersExportUrl({ status = "all", search = "" }) {
  const params = new URLSearchParams({ status });
  if (search) params.set("search", search);
  const baseURL = import.meta.env.VITE_API_BASE_URL || "";
  return `${baseURL}/admin/users/export?${params.toString()}`;
}

// --- Pandit Ji management ---

export function listPandits({ status = "pending", search = "", page = 1, pageSize = 10 }) {
  return get("/admin/pandits", {
    params: { status, search: search || undefined, page, page_size: pageSize },
  });
}

export function getPanditStatusCounts(search = "") {
  return get("/admin/pandits/counts", {
    params: { search: search || undefined },
  });
}

export function getPanditDetail(panditId) {
  return get(`/admin/pandits/${panditId}`);
}

export function approvePandit(panditId) {
  return patch(`/admin/pandits/${panditId}/approve`, {});
}

export function rejectPandit(panditId, reason) {
  return patch(`/admin/pandits/${panditId}/reject`, { reason: reason || undefined });
}

export function getPanditBulkTemplateUrl() {
  const baseURL = import.meta.env.VITE_API_BASE_URL || "";
  return `${baseURL}/admin/pandits/bulk-template`;
}

export function bulkUploadPandits(file) {
  const formData = new FormData();
  formData.append("file", file);
  return postForm("/admin/pandits/bulk-upload", formData);
}

export function resetPanditPassword(panditId) {
  return post(`/admin/pandits/${panditId}/reset-password`, {});
}

export function skipPanditAadharVerification(panditId) {
  return patch(`/admin/pandits/${panditId}/skip-aadhar`, {});
}

export function updatePanditAccountStatus(panditId, status, reason) {
  return patch(`/admin/pandits/${panditId}/account-status`, { status, reason: reason || undefined });
}

// --- Global settings ---

export function getPanditRegistrationSettings() {
  return get("/admin/settings/pandit-registration");
}

export function updatePanditRegistrationSettings(skipAadharVerification) {
  return put("/admin/settings/pandit-registration", { skip_aadhar_verification: skipAadharVerification });
}

export function getBookingLeadTimeSettings() {
  return get("/admin/settings/booking");
}

export function updateBookingLeadTimeSettings(minLeadHours) {
  return put("/admin/settings/booking", { min_lead_hours: minLeadHours });
}

export function getPricingSettings() {
  return get("/admin/settings/pricing");
}

export function updatePricingSettings({ premiumPackageFee, gstPercentage, platformFee }) {
  return put("/admin/settings/pricing", {
    premium_package_fee: premiumPackageFee,
    gst_percentage: gstPercentage,
    platform_fee: platformFee,
  });
}

export function getInvoiceSettings() {
  return get("/admin/settings/invoice");
}

export function updateInvoiceSettings({ companyName, companyGstin, companyAddress, companyState, sacCode }) {
  return put("/admin/settings/invoice", {
    company_name: companyName,
    company_gstin: companyGstin,
    company_address: companyAddress,
    company_state: companyState,
    sac_code: sacCode,
  });
}

export function getSocialLinksSettings() {
  return get("/admin/settings/social-links");
}

export function updateSocialLinksSettings({ instagram, facebook, whatsapp, xTwitter, linkedin, youtube, threads }) {
  return put("/admin/settings/social-links", {
    instagram,
    facebook,
    whatsapp,
    x_twitter: xTwitter,
    linkedin,
    youtube,
    threads,
  });
}

// --- Puja management ---

export function listAdminPujas({ search = "", listingType = "", page = 1, pageSize = 10 }) {
  return get("/admin/pujas", {
    params: { search: search || undefined, listing_type: listingType || undefined, page, page_size: pageSize },
  });
}

export function getAdminPujaDetail(pujaId) {
  return get(`/admin/pujas/${pujaId}`);
}

function toPujaFormData(fields) {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    formData.append(key, value);
  });
  return formData;
}

// Multipart requests: Content-Type must be left unset so the browser
// generates the correct multipart boundary itself. Overriding it to
// `undefined` here removes the axios instance's default JSON header
// for just this call.
const MULTIPART_CONFIG = { headers: { "Content-Type": undefined } };

export function createPuja(fields) {
  return post("/admin/pujas", toPujaFormData(fields), MULTIPART_CONFIG);
}

export function updatePuja(pujaId, fields) {
  return patch(`/admin/pujas/${pujaId}`, toPujaFormData(fields), MULTIPART_CONFIG);
}

export function setPujaStatus(pujaId, isActive) {
  return patch(`/admin/pujas/${pujaId}/status`, { is_active: isActive });
}

export function deletePuja(pujaId) {
  return del(`/admin/pujas/${pujaId}`);
}

// --- Booking operations ---

export function listAdminBookings({ status = "all", search = "", page = 1, pageSize = 20 }) {
  return get("/admin/bookings", {
    params: { status, search: search || undefined, page, page_size: pageSize },
  });
}

export function getAdminBooking(bookingId) {
  return get(`/admin/bookings/${bookingId}`);
}

export function listDeclinedBookingHistory({ page = 1, pageSize = 20 }) {
  return get("/admin/bookings/declined-history", { params: { page, page_size: pageSize } });
}

export function getDeclineAlerts() {
  return get("/admin/pandits/decline-alerts");
}

export function listEligiblePandits(bookingId) {
  return get(`/admin/bookings/${bookingId}/eligible-pandits`);
}

export function reassignAdminBooking(bookingId, panditId, note) {
  return post(`/admin/bookings/${bookingId}/reassign`, {
    pandit_id: panditId,
    note: note || undefined,
  });
}

// --- Coupons & Offers management ---

export function listCoupons({ type = "general", search = "", page = 1, pageSize = 10 }) {
  return get("/admin/coupons", {
    params: { type, search: search || undefined, page, page_size: pageSize },
  });
}

export function getCouponDetail(couponId) {
  return get(`/admin/coupons/${couponId}`);
}

export function createCoupon(payload) {
  return post("/admin/coupons", payload);
}

export function updateCoupon(couponId, payload) {
  return patch(`/admin/coupons/${couponId}`, payload);
}

export function deleteCoupon(couponId) {
  return del(`/admin/coupons/${couponId}`);
}

// --- Shubh Muhurat management ---

export function listMuhrats({ search = "", page = 1, pageSize = 10 }) {
  return get("/admin/muhrats", {
    params: { search: search || undefined, page, page_size: pageSize },
  });
}

export function getMuhuratDetail(muhratId) {
  return get(`/admin/muhrats/${muhratId}`);
}

export function createMuhurat(payload) {
  return post("/admin/muhrats", payload);
}

export function updateMuhurat(muhratId, payload) {
  return patch(`/admin/muhrats/${muhratId}`, payload);
}

export function deleteMuhurat(muhratId) {
  return del(`/admin/muhrats/${muhratId}`);
}

// --- Testimonials (reviews) management ---

export function listReviews({ status = "all", page = 1, pageSize = 10 }) {
  return get("/admin/reviews", { params: { status, page, page_size: pageSize } });
}

export function getReviewStatusCounts() {
  return get("/admin/reviews/counts");
}

export function getReviewDetail(reviewId) {
  return get(`/admin/reviews/${reviewId}`);
}

export function setReviewStatus(reviewId, status) {
  return patch(`/admin/reviews/${reviewId}/status`, { status });
}

export function setReviewCoverPhoto(reviewId, photoIndex) {
  return patch(`/admin/reviews/${reviewId}/cover-photo`, { photo_index: photoIndex });
}

export function deleteReview(reviewId) {
  return del(`/admin/reviews/${reviewId}`);
}

// --- Support (contact-us requests) ---

export function listSupportRequests({ status = "all", search = "", page = 1, pageSize = 10 }) {
  return get("/admin/support", {
    params: { status, search: search || undefined, page, page_size: pageSize },
  });
}

export function getSupportStatusCounts(search = "") {
  return get("/admin/support/counts", { params: { search: search || undefined } });
}

export function getSupportDetail(messageId) {
  return get(`/admin/support/${messageId}`);
}

export function updateSupportRequest(messageId, status, adminNotes) {
  return patch(`/admin/support/${messageId}`, { status, admin_notes: adminNotes });
}

// --- Complaints (post-puja disputes) ---

export function listComplaints({ status = "all", search = "", page = 1, pageSize = 10 }) {
  return get("/admin/complaints", {
    params: { status, search: search || undefined, page, page_size: pageSize },
  });
}

export function getComplaintStatusCounts(search = "") {
  return get("/admin/complaints/counts", { params: { search: search || undefined } });
}

export function getComplaintDetailAdmin(complaintId) {
  return get(`/admin/complaints/${complaintId}`);
}

export function updateComplaintStatus(complaintId, status) {
  return patch(`/admin/complaints/${complaintId}/status`, { status });
}

export function replyToComplaint(complaintId, body) {
  return post(`/admin/complaints/${complaintId}/reply`, { body });
}

export function resolveComplaint(complaintId, { resolution, replyMessage, refundType, refundAmount }) {
  return post(`/admin/complaints/${complaintId}/resolve`, {
    resolution,
    reply_message: replyMessage || undefined,
    refund_type: refundType || undefined,
    refund_amount: refundAmount || undefined,
  });
}

// --- Pandit Ji feedback (internal, to admin) ---

export function listPanditFeedback({ search = "", rating = "", page = 1, pageSize = 10 }) {
  return get("/admin/pandit-feedback", {
    params: { search: search || undefined, rating: rating || undefined, page, page_size: pageSize },
  });
}

export function getPanditFeedbackSummary() {
  return get("/admin/pandit-feedback/summary");
}

// --- Settings ---

export function getAdminProfile() {
  return get("/admin/settings/profile");
}

export function changeAdminPassword(currentPassword, newPassword) {
  return post("/admin/settings/change-password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

// --- Audit log ---

export function listAuditEvents({ action = "", entity = "", dateFrom = "", dateTo = "", page = 1, pageSize = 25 }) {
  return get("/audit/events", {
    params: {
      action: action || undefined,
      entity: entity || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      page,
      page_size: pageSize,
    },
  });
}

// --- Wallet & Transactions ---

export function getWalletSummary() {
  return get("/admin/wallet/summary");
}

export function listWalletTransactions({ role = "", type = "", reason = "", search = "", dateFrom = "", dateTo = "", page = 1, pageSize = 20 }) {
  return get("/admin/wallet/transactions", {
    params: {
      role: role || undefined,
      type: type || undefined,
      reason: reason || undefined,
      search: search || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      page,
      page_size: pageSize,
    },
  });
}

export function listWalletTransactionReasons() {
  return get("/admin/wallet/transactions/reasons");
}

export function listBookingPayments({ status = "", search = "", dateFrom = "", dateTo = "", page = 1, pageSize = 20 }) {
  return get("/admin/wallet/bookings", {
    params: {
      status: status || undefined,
      search: search || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      page,
      page_size: pageSize,
    },
  });
}

export function listWithdrawalRequests({ status = "pending", page = 1, pageSize = 20 }) {
  return get("/admin/wallet/withdrawals", { params: { status, page, page_size: pageSize } });
}

export function processWithdrawalRequest(withdrawalId, action, adminNotes, { payoutReference = "", payoutMethod = "" } = {}) {
  return patch(`/admin/wallet/withdrawals/${withdrawalId}`, {
    action,
    admin_notes: adminNotes || undefined,
    payout_reference: payoutReference || undefined,
    payout_method: payoutMethod || undefined,
  });
}

export function revealWithdrawalBankDetails(withdrawalId) {
  return get(`/admin/wallet/withdrawals/${withdrawalId}/bank-details`);
}

export function listPanditEarnings({ status = "pending", page = 1, pageSize = 20 }) {
  return get("/admin/wallet/pandit-earnings", { params: { status, page, page_size: pageSize } });
}

export function releasePanditEarning(bookingId, { amount, adminNotes } = {}) {
  return post(`/admin/wallet/pandit-earnings/${bookingId}/release`, {
    amount: amount || undefined,
    admin_notes: adminNotes || undefined,
  });
}

// --- Reports & analytics ---

export function getReportsSummary({ dateRange = "last_30_days", pujaId = "", city = "" }) {
  return get("/admin/reports/summary", {
    params: { date_range: dateRange, puja_id: pujaId || undefined, city: city || undefined },
  });
}

export function getReportsTrend({ pujaId = "", city = "" }) {
  return get("/admin/reports/trend", {
    params: { puja_id: pujaId || undefined, city: city || undefined },
  });
}

export function getTopCities({ dateRange = "last_30_days", pujaId = "" }) {
  return get("/admin/reports/top-cities", {
    params: { date_range: dateRange, puja_id: pujaId || undefined },
  });
}

export function getBookingInvoiceUrl(bookingId, type = "customer") {
  const baseURL = import.meta.env.VITE_API_BASE_URL || "";
  return `${baseURL}/admin/bookings/${bookingId}/invoice?type=${type}`;
}

export function getReportsExportUrl({ dateRange = "last_30_days", pujaId = "", city = "" }) {
  const params = new URLSearchParams({ date_range: dateRange });
  if (pujaId) params.set("puja_id", pujaId);
  if (city) params.set("city", city);
  const baseURL = import.meta.env.VITE_API_BASE_URL || "";
  return `${baseURL}/admin/reports/export?${params.toString()}`;
}

// --- Package Puja bookings ---

export function listPackageBookings({ status = "all", search = "", page = 1, pageSize = 10 }) {
  return get("/admin/package-bookings", {
    params: { status, search: search || undefined, page, page_size: pageSize },
  });
}

export function getPackageBookingStatusCounts(search = "") {
  return get("/admin/package-bookings/counts", { params: { search: search || undefined } });
}

export function getPackageBookingDetail(bookingId) {
  return get(`/admin/package-bookings/${bookingId}`);
}

export function quotePackageBooking(bookingId, amount, note) {
  return post(`/admin/package-bookings/${bookingId}/quote`, { amount, note: note || undefined });
}

export function assignPanditToPackageBooking(bookingId, panditId) {
  return post(`/admin/package-bookings/${bookingId}/assign-pandit`, { pandit_id: panditId });
}

export function cancelPackageBookingAdmin(bookingId, reason) {
  return post(`/admin/package-bookings/${bookingId}/cancel`, { reason });
}
