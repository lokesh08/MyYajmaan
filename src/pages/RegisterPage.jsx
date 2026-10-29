import { useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { withAbortPost } from "../api";
import { showError, showSuccess } from "../utils/toaster";
import {
  sanitizeInput,
  validate,
  isValidPhone,
} from "../utils/validation";
import { authBackgrounds } from "../constants/visualAssets";
import FullScreenLoader from "../components/common/FullScreenLoader";
import YajmaanBenefits from "../components/YajmaanBenefits";
import { optimizedImage } from "../utils/image";

const backgroundImage = authBackgrounds.register;

function getReadableError(error) {
  if (!error) {
    return "Registration failed. Please try again.";
  }

  if (
    error.isCanceled ||
    error.name === "CanceledError"
  ) {
    return null;
  }

  const responseData =
    error?.data ||
    error?.response?.data ||
    null;

  const detail = responseData?.detail;

  if (
    typeof detail === "object" &&
    detail?.message
  ) {
    return detail.message;
  }

  if (typeof detail === "string") {
    return detail;
  }

  if (responseData?.message) {
    return responseData.message;
  }

  if (
    error?.message &&
    !error.message.startsWith("{")
  ) {
    return error.message;
  }

  if (error?.status === 409) {
    return "An account with this email already exists. Please log in instead.";
  }

  return "Registration failed. Please check your details and try again.";
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const formCardRef = useRef(null);
  const [searchParams] = useSearchParams();
  const referralCode = (searchParams.get("ref") || "").trim();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleFullNameChange(event) {
    const value = event.target.value || "";

    const cleaned = value
      .replace(/<[^>]*>?/gm, "")
      .replace(
        /[\u0000-\u001F\u007F-\u009F]/g,
        "",
      )
      .replace(/[^\p{L}\s'-]/gu, "");

    setFullName(cleaned);
  }

  function handlePhoneChange(event) {
    const value = event.target.value || "";
    const cleaned = value.replace(
      /[^\d+\s\-()]/g,
      "",
    );

    setPhone(cleaned);
  }

  function handleEmailChange(event) {
    setEmail(
      sanitizeInput(event.target.value || ""),
    );
  }

  function handlePasswordChange(event) {
    setPassword(event.target.value || "");
  }

  function handleConfirmPasswordChange(event) {
    setConfirmPassword(event.target.value || "");
  }

  async function handleRegister(event) {
    event.preventDefault();

    const cleanFullName = sanitizeInput(fullName);
    const cleanEmail = sanitizeInput(email);
    const cleanPhone = sanitizeInput(phone);

    const fields = {
      fullName: cleanFullName,
      email: cleanEmail,
      phone: cleanPhone,
      password,
      confirmPassword,
    };

    const rules = {
      fullName: {
        required: true,
        type: "name",
        message: "Please enter your full name.",
      },
      email: {
        required: true,
        type: "email",
        message: "Please enter a valid email address.",
      },
      phone: {
        required: true,
        type: "phone",
        message: "Please enter a valid phone number.",
      },
      password: {
        required: true,
        min: 6,
        message:
          "Password must contain at least 6 characters.",
      },
      confirmPassword: {
        required: true,
        custom: (value, allValues) =>
          value === allValues.password ||
          "Passwords do not match.",
      },
    };

    const validationResult = validate(
      fields,
      rules,
    );

    if (!validationResult.valid) {
      const firstError = Object.values(
        validationResult.errors,
      )[0];

      showError(
        firstError ||
          "Please check the entered information.",
      );

      return;
    }

    if (!isValidPhone(cleanPhone)) {
      showError("Please enter a valid phone number.");
      return;
    }

    if (!agreedToTerms) {
      showError("Please agree to the Privacy Policy and Terms and Conditions to continue.");
      return;
    }

    setLoading(true);

    try {
      const { promise } = withAbortPost(
        "/auth/register",
        {
          email: cleanEmail,
          password,
          full_name: cleanFullName,
          phone: cleanPhone,
          referral_code: referralCode || undefined,
          agreed_to_terms: agreedToTerms,
        },
      );

      const result = await promise;

      showSuccess(
        "Your account was created. Please verify your email and mobile number.",
      );

      // One-time email + phone OTP verification comes before the
      // first login. The codes were just sent by the registration call.
      navigate("/verify-otp", {
        state: { email: cleanEmail.toLowerCase(), portal: "customer", otp: result?.otp },
      });
    } catch (error) {
      console.error(
        "Registration error:",
        error,
      );

      const message = getReadableError(error);

      if (message) {
        showError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <FullScreenLoader
        open={loading}
        message="Creating your account..."
      />

      <section className="mx-auto max-w-6xl px-6 py-10 lg:px-8">
        <div ref={formCardRef} className="grid overflow-hidden rounded-[2rem] border border-amber-100 bg-white shadow-sm lg:grid-cols-[0.95fr_1.05fr]">
          <div className="relative min-h-[320px] overflow-hidden bg-maroon-dark p-8 text-white lg:min-h-[600px]">
            <img
              src={backgroundImage}
              alt="Festival background"
              className="absolute inset-0 h-full w-full object-cover opacity-30"
            />

            <div className="absolute inset-0 bg-gradient-to-br from-brown-dark via-maroon-dark/80 to-marigold/80" />

            <div className="relative flex h-full flex-col justify-between">
              <div>
                <div className="h-12 w-12 overflow-hidden rounded-full border border-white/25">
                  <img src={optimizedImage("/images/logo-mark.png")} alt="MyYajmaan" className="h-full w-full object-cover" />
                </div>

                <p className="mt-4 text-sm font-semibold uppercase tracking-[0.2em] text-amber-100">
                  Join MyYajmaan
                </p>

                <h1 className="mt-3 max-w-md font-serif text-3xl font-semibold leading-tight">
                  Create your spiritual booking profile
                </h1>

                <p className="mt-3 max-w-md text-sm leading-6 text-amber-50">
                  Sign up to discover pujas, trusted pandits, and meaningful spiritual services.
                </p>
              </div>

              <div className="grid gap-3 rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
                <div className="rounded-xl bg-white/10 px-3 py-2 text-sm">
                  • Find trusted pandits
                </div>

                <div className="rounded-xl bg-white/10 px-3 py-2 text-sm">
                  • Book pujas for your family
                </div>

                <div className="rounded-xl bg-white/10 px-3 py-2 text-sm">
                  • Track bookings and rewards
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 lg:p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-marigold">
              Account
            </p>

            <h2 className="mt-2 font-serif text-3xl font-semibold text-maroon-dark">
              Create your account
            </h2>

            <p className="mt-2 text-sm text-slate-600">
              Register as a customer to book trusted pandits and pujas.
            </p>

            {referralCode && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-maroon">
                🎉 Referred by a friend — sign up to get your welcome bonus!
              </p>
            )}

            <form
              onSubmit={handleRegister}
              className="mt-6 grid gap-4 md:grid-cols-2"
              noValidate
            >
              <label className="block">
                <span className="sr-only">
                  Full name
                </span>

                <input
                  value={fullName}
                  onChange={handleFullNameChange}
                  type="text"
                  autoComplete="name"
                  placeholder="Full name *"
                  className="w-full rounded-xl border border-amber-100 px-4 py-3 outline-none focus:border-amber-400"
                />
              </label>

              <label className="block">
                <span className="sr-only">
                  Phone number
                </span>

                <input
                  value={phone}
                  onChange={handlePhoneChange}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="Mobile number *"
                  className="w-full rounded-xl border border-amber-100 px-4 py-3 outline-none focus:border-amber-400"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="sr-only">
                  Email address
                </span>

                <input
                  value={email}
                  onChange={handleEmailChange}
                  type="email"
                  autoComplete="email"
                  placeholder="Email address *"
                  className="w-full rounded-xl border border-amber-100 px-4 py-3 outline-none focus:border-amber-400"
                />
              </label>

              <label className="block">
                <span className="sr-only">
                  Password
                </span>

                <input
                  value={password}
                  onChange={handlePasswordChange}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Password *"
                  className="w-full rounded-xl border border-amber-100 px-4 py-3 outline-none focus:border-amber-400"
                />
              </label>

              <label className="block">
                <span className="sr-only">
                  Confirm password
                </span>

                <input
                  value={confirmPassword}
                  onChange={handleConfirmPasswordChange}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Confirm password *"
                  className="w-full rounded-xl border border-amber-100 px-4 py-3 outline-none focus:border-amber-400"
                />
              </label>

              <label className="flex items-start gap-2 text-sm text-slate-600 md:col-span-2">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(event) => setAgreedToTerms(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-amber-300 text-maroon focus:ring-amber-200"
                />
                <span>
                  I agree to the{" "}
                  <Link to="/privacy-policy" title="Read the Privacy Policy" target="_blank" className="font-semibold text-maroon hover:underline">
                    Privacy Policy
                  </Link>{" "}
                  and{" "}
                  <Link to="/terms-and-conditions" title="Read the Terms and Conditions" target="_blank" className="font-semibold text-maroon hover:underline">
                    Terms and Conditions
                  </Link>
                  . *
                </span>
              </label>

              <div className="mt-4 flex flex-wrap items-center gap-3 md:col-span-2">
                <button
                  type="submit"
                  disabled={loading || !agreedToTerms}
                  title={!agreedToTerms ? "Please agree to the Privacy Policy and Terms and Conditions first" : "Create your account"}
                  className="interactive-button rounded-full bg-maroon-dark px-6 py-3 font-semibold text-white hover:bg-maroon disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Register
                </button>

                <Link
                  to="/login"
                  title="Go to login"
                  className="rounded-full border border-amber-200 px-6 py-3 font-semibold text-slate-700"
                >
                  Already have an account?
                </Link>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Form first, so it's what opens on screen; the benefits follow,
          with a button back up to the form. */}
      <section className="mx-auto max-w-6xl px-6 pb-10 lg:px-8">
        <YajmaanBenefits
          ctaLabel="Create Your Account ↑"
          onCtaClick={() => formCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
        />
      </section>
    </>
  );
}