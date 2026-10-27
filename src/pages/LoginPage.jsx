import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { post } from "../api";
import { showError, showSuccess } from "../utils/toaster";
import {
  sanitizeInput,
  isValidEmail,
} from "../utils/validation";
import FullScreenLoader from "../components/common/FullScreenLoader";
import YajmaanBenefits from "../components/YajmaanBenefits";
import { authBackgrounds } from "../constants/visualAssets";
import { ADMIN_DASHBOARD_PATH } from "../constants/adminRoutes";
import { useAuth } from "../context/AuthContext";
import { optimizedImage } from "../utils/image";

const backgroundImage = authBackgrounds.login;

function getReadableError(error) {
  if (!error) {
    return "Login failed. Please try again.";
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

  if (error?.status === 401) {
    return "Your email or password is incorrect.";
  }

  if (error?.status === 409) {
    return "An account with this email already exists.";
  }

  if (
    error?.message &&
    !error.message.startsWith("{")
  ) {
    return error.message;
  }

  return "Login failed. Please check your credentials and try again.";
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { applyLogin } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  function handleEmailChange(event) {
    setEmail(event.target.value || "");
  }

  function handlePasswordChange(event) {
    setPassword(event.target.value || "");
  }

  async function handleLogin(event) {
    event.preventDefault();

    const cleanEmail = sanitizeInput(email)
      .toLowerCase()
      .trim();

    if (!cleanEmail) {
      showError("Please enter your email address.");
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      showError("Please enter a valid email address.");
      return;
    }

    if (!password) {
      showError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      const result = await post("/auth/login", {
        email: cleanEmail,
        password,
        portal: "customer",
      });

      if (!result?.user) {
        throw new Error(
          "Your account profile could not be loaded.",
        );
      }

      applyLogin(result.user);

      showSuccess(
        "Login successful. Welcome back!",
      );

      // RoleRoute (e.g. the booking flow's login gate) sends visitors
      // here with the page they were trying to reach in state.from --
      // honor that over the default role dashboard so "log in to
      // continue booking" actually returns them to booking.
      const destination =
        location.state?.from ||
        (result.user.role === "admin"
          ? ADMIN_DASHBOARD_PATH
          : result.user.role === "pandit"
            ? "/pandit"
            : "/dashboard");

      navigate(destination);
    } catch (error) {
      // Self-registered account whose one-time email + phone
      // verification isn't finished yet -- send them to finish it.
      if (error?.code === "VERIFICATION_REQUIRED") {
        showError(error.message);
        navigate("/verify-otp", { state: { email: cleanEmail, portal: "customer" } });
        return;
      }

      console.error("Login error:", error);

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
        message="Signing you in..."
      />

      <section className="mx-auto max-w-6xl px-6 pt-10 lg:px-8">
        <YajmaanBenefits ctaLabel="New to MyYajmaan? Register Now →" />
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10 lg:px-8">
        <div className="grid overflow-hidden rounded-[2rem] border border-amber-100 bg-white shadow-sm lg:grid-cols-[0.95fr_1.05fr]">
          <div className="relative min-h-[320px] overflow-hidden bg-maroon-dark p-8 text-white lg:min-h-[560px]">
            <img
              src={backgroundImage}
              alt="Festival background"
              className="absolute inset-0 h-full w-full object-cover opacity-30"
            />

            <div className="absolute inset-0 bg-gradient-to-br from-maroon-dark via-maroon/80 to-marigold/80" />

            <div className="relative flex h-full flex-col justify-between">
              <div>
                <div className="h-12 w-12 overflow-hidden rounded-full border border-white/25">
                  <img src={optimizedImage("/images/logo-mark.png")} alt="MyYajmaan" className="h-full w-full object-cover" />
                </div>

                <p className="mt-4 text-sm font-semibold uppercase tracking-[0.2em] text-amber-100">
                  MyYajmaan
                </p>

                <h1 className="mt-3 max-w-md font-serif text-3xl font-semibold leading-tight">
                  Your spiritual booking account
                </h1>

                <p className="mt-3 max-w-md text-sm leading-6 text-amber-50">
                  Track bookings, rewards, and trusted pandit services from one place.
                </p>
              </div>

              <div className="grid gap-3 rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
                <div className="rounded-xl bg-white/10 px-3 py-2 text-sm">
                  • Book verified pandits
                </div>

                <div className="rounded-xl bg-white/10 px-3 py-2 text-sm">
                  • Manage upcoming pujas
                </div>

                <div className="rounded-xl bg-white/10 px-3 py-2 text-sm">
                  • View rewards and booking history
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 lg:p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-marigold">
              Account
            </p>

            <h2 className="mt-2 font-serif text-3xl font-semibold text-maroon-dark">
              Welcome back
            </h2>

            <p className="mt-2 text-sm text-slate-600">
              Sign in to manage your pujas, bookings, and rewards.
            </p>

            <form
              onSubmit={handleLogin}
              className="mt-6 grid gap-4"
              noValidate
            >
              <label className="block">
                <span className="sr-only">
                  Email address
                </span>

                <input
                  value={email}
                  onChange={handleEmailChange}
                  type="email"
                  autoComplete="email"
                  placeholder="Email address"
                  disabled={loading}
                  className="w-full rounded-xl border border-amber-100 px-4 py-3 outline-none focus:border-amber-400 disabled:bg-slate-50"
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
                  autoComplete="current-password"
                  placeholder="Password"
                  disabled={loading}
                  className="w-full rounded-xl border border-amber-100 px-4 py-3 outline-none focus:border-amber-400 disabled:bg-slate-50"
                />
              </label>

              <div className="text-right">
                <Link
                  to="/forgot-password"
                  title="Reset your password"
                  className="text-sm font-semibold text-maroon hover:text-saffron"
                >
                  Forgot password?
                </Link>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="interactive-button rounded-full bg-maroon-dark px-6 py-3 font-semibold text-white hover:bg-maroon disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Login
                </button>

                <Link
                  to="/register"
                  title="Create a new account"
                  className="rounded-full border border-amber-200 px-6 py-3 font-semibold text-slate-700"
                >
                  Create account
                </Link>
              </div>
            </form>
          </div>
        </div>
      </section>
    </>
  );
}