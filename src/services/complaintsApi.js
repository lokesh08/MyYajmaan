import { get, post } from "../api";

export function raiseComplaint({ bookingId, subject, description }) {
  return post("/complaints", { booking_id: bookingId, subject, description });
}

export function listMyComplaints() {
  return get("/complaints/mine");
}

export function getComplaintForBooking(bookingId) {
  return get(`/complaints/by-booking/${bookingId}`);
}

export function getComplaintDetail(complaintId) {
  return get(`/complaints/${complaintId}`);
}

export function addComplaintMessage(complaintId, body) {
  return post(`/complaints/${complaintId}/messages`, { body });
}
