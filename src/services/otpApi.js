import { post } from "../api";

// One-time email + phone verification for new accounts. These are
// public endpoints (no session exists yet), keyed by the signup email.

export function sendSignupOtp(email, channel = "both") {
  return post("/auth/otp/send", { email, channel });
}

export function verifySignupOtp(email, channel, code) {
  return post("/auth/otp/verify", { email, channel, code });
}

export function getSignupOtpStatus(email) {
  return post("/auth/otp/status", { email });
}
