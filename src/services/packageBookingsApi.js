import { get, post } from "../api";

export function createPackageBooking(payload) {
  return post("/package-bookings", {
    catalog_puja_id: payload.catalogPujaId,
    date: payload.date,
    timeslot: payload.timeslot,
    contact_name: payload.contactName,
    contact_phone: payload.contactPhone,
    address_line: payload.addressLine,
    address_city: payload.addressCity,
    address_state: payload.addressState,
    address_pincode: payload.addressPincode,
    event_details: payload.eventDetails,
  });
}

export function listMyPackageBookings() {
  return get("/package-bookings/mine");
}

export function cancelMyPackageBooking(bookingId) {
  return post(`/package-bookings/${bookingId}/cancel`, {});
}

export function confirmPackageBookingPayment(bookingId, paymentRef) {
  return post(`/package-bookings/${bookingId}/confirm-payment`, { payment_ref: paymentRef });
}
