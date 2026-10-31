import { useState } from "react";
import { Link } from "react-router-dom";

import { post } from "../api";
import { showError } from "../utils/toaster";
import { sanitizeInput, isValidEmail } from "../utils/validation";
import FullScreenLoader from "../components/common/FullScreenLoader";
import { t } from "../i18n";

/**
 * Shared "Forgot password" entry point for both customers and Pandit
 * Ji accounts (admin is intentionally not covered here -- the Admin
 * portal has no self-service reset). Always shows the same success
 * message regardless of whether the email is on file, matching the
 * backend's response, so this page can't be used to probe accounts.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    const cleanEmail = sanitizeInput(email).toLowerCase().trim();
    if (!isValidEmail(cleanEmail)) {
      showError(t("Please enter a valid email address."));
      return;
    }

    setLoading(true);
    try {
      await post("/auth/forgot-password", { email: cleanEmail });
      setSubmitted(true);
    } catch (error) {
      showError(error?.message || t("Something went wrong. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <FullScreenLoader open={loading} message={t("Sending reset link...")} />

      <section className="mx-auto max-w-md px-4 py-12 sm:px-6">
        <div className="rounded-[2rem] border border-amber-100 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-marigold">{t("Account")}</p>
          <h1 className="mt-2 font-serif text-3xl font-semibold text-maroon-dark">{t("Forgot password?")}</h1>

          {submitted ? (
            <>
              <p className="mt-3 text-sm text-slate-600">
                {t("If an account exists with")}{' '}<strong>{sanitizeInput(email).trim()}</strong>{t(", we've sent a password reset link to it. Open that email and click the link to set a new password.")}
              </p>
              <Link
                to="/login"
                title={t("Back to login")}
                className="interactive-button mt-6 inline-block rounded-full bg-maroon-dark px-6 py-3 text-sm font-semibold text-white hover:bg-maroon"
              >
                {t("Back to login")}
              </Link>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm text-slate-600">
                {t("Enter the email address on your account and we'll send you a link to reset your password.")}
              </p>

              <form onSubmit={handleSubmit} className="mt-6 grid gap-4" noValidate>
                <label className="block">
                  <span className="sr-only">{t("Email address")}</span>
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    autoComplete="email"
                    placeholder={t("Email address")}
                    disabled={loading}
                    className="w-full rounded-xl border border-amber-100 px-4 py-3 outline-none focus:border-amber-400 disabled:bg-slate-50"
                  />
                </label>

                <div className="mt-2 flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="interactive-button rounded-full bg-maroon-dark px-6 py-3 font-semibold text-white hover:bg-maroon disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {t("Send reset link")}
                  </button>
                  <Link
                    to="/login"
                    title={t("Back to login")}
                    className="rounded-full border border-amber-200 px-6 py-3 font-semibold text-slate-700"
                  >
                    {t("Back to login")}
                  </Link>
                </div>
              </form>

              <p className="mt-5 text-center text-sm text-slate-500">
                {t("Pandit Ji?")}{" "}
                <Link to="/pandit/login" title={t("Go to Pandit Ji login")} className="font-semibold text-maroon hover:text-saffron">
                  {t("Use the Pandit Ji login page")}
                </Link>{" "}
                {t("instead -- this reset link works for either.")}
              </p>
            </>
          )}
        </div>
      </section>
    </>
  );
}
