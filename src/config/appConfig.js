// Front-end configuration. Everything here ships to the browser, so it
// must never hold a secret -- API secrets (Razorpay key secret, SMTP
// password, SMS auth key) live only in the backend's environment
// (myyajmaan-api/.env locally, real env variables on deployment).

// Sign out after this long with no keyboard, mouse or touch activity.
// Override per environment with VITE_IDLE_LOGOUT_MINUTES.
const idleMinutes = Number(import.meta.env.VITE_IDLE_LOGOUT_MINUTES);
export const IDLE_LOGOUT_MS =
  (Number.isFinite(idleMinutes) && idleMinutes > 0 ? idleMinutes : 30) * 60 * 1000;
