import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import {
  getSignupOtpStatus,
  sendSignupOtp,
  verifySignupOtp,
} from "../services/otpApi";
import { showError, showInfo, showSuccess } from "../utils/toaster";
import FullScreenLoader from "../components/common/FullScreenLoader";

const CHANNELS = [
  { key: "email", label: "Email", placeholder: "6-digit code from your email" },
  { key: "phone", label: "Mobile number", placeholder: "6-digit code from your SMS" },
];

// Matches the backend's default OTP_RESEND_COOLDOWN_SECONDS; when the
// server reports a different remaining wait it takes precedence.
const DEFAULT_COOLDOWN_SECONDS = 30;

function loginPathFor(portal) {
  return portal === "pandit" ? "/pandit/login" : "/login";
}

/**
 * One-time verification after signing up: the person enters the code
 * sent to their email AND the code sent to their phone. Only once both
 * are verified can the account log in (enforced by the backend, not
 * just this screen).
 *
 * Arrives with `state = { email, portal, otp? }` from registration (the
 * codes were just sent, so nothing is re-sent), or from a blocked login
 * attempt (codes are sent on arrival).
 */
export default function VerifyOtpPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const email = (state?.email || "").trim().toLowerCase();
  const portal = state?.portal === "pandit" ? "pandit" : "customer";

  const [verified, setVerified] = useState({ email: false, phone: false });
  const [codes, setCodes] = useState({ email: "", phone: "" });
  const [cooldown, setCooldown] = useState({ email: 0, phone: 0 });
  const [busy, setBusy] = useState({ email: false, phone: false });
  const [devOtps, setDevOtps] = useState({});
  const [checking, setChecking] = useState(true);
  const finishedRef = useRef(false);

  function applySendResults(results = []) {
    const nextCooldown = {};
    const nextDev = {};
    const nextVerified = {};

    results.forEach((result) => {
      if (result.already_verified) {
        nextVerified[result.channel] = true;
      } else if (result.sent) {
        nextCooldown[result.channel] = DEFAULT_COOLDOWN_SECONDS;
        if (result.dev_otp) nextDev[result.channel] = result.dev_otp;
      } else if (result.error_code === "OTP_COOLDOWN") {
        // A code was already sent moments ago (e.g. straight from
        // registration) -- not an error worth alarming anyone about.
        nextCooldown[result.channel] = result.retry_after || DEFAULT_COOLDOWN_SECONDS;
      } else if (result.message) {
        showError(result.message);
      }
    });

    setCooldown((current) => ({ ...current, ...nextCooldown }));
    setDevOtps((current) => ({ ...current, ...nextDev }));
    setVerified((current) => ({ ...current, ...nextVerified }));
  }

  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    showSuccess("Email and mobile verified. You can now log in.");
    navigate(loginPathFor(portal), { replace: true, state: { email } });
  }

  // Initial state: what's already verified, and (when arriving from a
  // blocked login rather than from registration) send fresh codes.
  useEffect(() => {
    if (!email) return undefined;
    let cancelled = false;

    async function init() {
      try {
        const status = await getSignupOtpStatus(email);
        if (cancelled) return;

        if (!status?.pending) {
          showInfo("This account is already verified. Please log in.");
          navigate(loginPathFor(portal), { replace: true, state: { email } });
          return;
        }

        setVerified({ email: status.email_verified, phone: status.phone_verified });

        if (state?.otp) {
          applySendResults(state.otp);
        } else {
          applySendResults((await sendSignupOtp(email, "both"))?.results);
        }
      } catch (error) {
        if (!cancelled) showError(error?.message || "Could not start verification. Please try again.");
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  // Resend countdowns.
  useEffect(() => {
    if (cooldown.email <= 0 && cooldown.phone <= 0) return undefined;
    const timer = setInterval(() => {
      setCooldown((current) => ({
        email: Math.max(0, current.email - 1),
        phone: Math.max(0, current.phone - 1),
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown.email > 0, cooldown.phone > 0]);

  async function handleVerify(channel) {
    const code = codes[channel].trim();
    if (!/^\d{6}$/.test(code)) {
      showError("Please enter the 6-digit code.");
      return;
    }

    setBusy((current) => ({ ...current, [channel]: true }));
    try {
      const result = await verifySignupOtp(email, channel, code);

      if (!result?.verified) {
        showError(result?.message || "That code could not be verified.");
        return;
      }

      setVerified({ email: result.email_verified, phone: result.phone_verified });
      showSuccess(`${channel === "email" ? "Email" : "Mobile number"} verified.`);

      if (result.fully_verified) finish();
    } catch (error) {
      showError(error?.message || "Could not verify the code. Please try again.");
    } finally {
      setBusy((current) => ({ ...current, [channel]: false }));
    }
  }

  async function handleResend(channel) {
    setBusy((current) => ({ ...current, [channel]: true }));
    try {
      applySendResults((await sendSignupOtp(email, channel))?.results);
    } catch (error) {
      showError(error?.message || "Could not send a new code. Please try again.");
    } finally {
      setBusy((current) => ({ ...current, [channel]: false }));
    }
  }

  // Opened directly (no signup / login attempt behind it): nothing to verify.
  if (!email) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <FullScreenLoader open={checking} message="Preparing verification..." />

      <section className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="rounded-[2rem] border border-amber-100 bg-white p-6 shadow-sm sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-marigold">
            One-time verification
          </p>
          <h1 className="mt-2 font-serif text-3xl font-semibold text-maroon-dark">
            Verify your email and mobile number
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            We sent a code to <span className="font-semibold">{email}</span> and to your mobile
            number. Enter both codes to activate your account. You only need to do this once.
          </p>

          <div className="mt-6 space-y-4">
            {CHANNELS.map(({ key, label, placeholder }) => (
              <div key={key} className="rounded-2xl border border-amber-100 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-800">{label}</p>
                  {verified[key] && (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      ✓ Verified
                    </span>
                  )}
                </div>

                {!verified[key] && (
                  <>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <input
                        value={codes[key]}
                        onChange={(event) =>
                          setCodes((current) => ({
                            ...current,
                            [key]: event.target.value.replace(/\D/g, "").slice(0, 6),
                          }))
                        }
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        placeholder={placeholder}
                        aria-label={`${label} verification code`}
                        className="min-w-0 flex-1 rounded-xl border border-amber-100 px-4 py-3 tracking-[0.3em] outline-none focus:border-amber-400"
                      />
                      <button
                        type="button"
                        onClick={() => handleVerify(key)}
                        disabled={busy[key] || codes[key].length !== 6}
                        className="interactive-button rounded-full bg-maroon-dark px-5 py-3 text-sm font-semibold text-white hover:bg-maroon disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busy[key] ? "Checking..." : "Verify"}
                      </button>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <button
                        type="button"
                        onClick={() => handleResend(key)}
                        disabled={busy[key] || cooldown[key] > 0}
                        className="font-semibold text-maroon hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
                      >
                        {cooldown[key] > 0 ? `Resend code in ${cooldown[key]}s` : "Resend code"}
                      </button>

                      {devOtps[key] && (
                        <span className="rounded bg-amber-50 px-2 py-1 font-mono text-amber-800">
                          DEV ONLY: {devOtps[key]}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          <p className="mt-6 text-sm text-slate-500">
            Didn't get a code? Use "Resend code" above. Already verified both?{" "}
            <Link to={loginPathFor(portal)} className="font-semibold text-maroon hover:underline">
              Go to log in
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
