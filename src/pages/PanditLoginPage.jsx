import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { post } from "../api";
import FullScreenLoader from "../components/common/FullScreenLoader";
import EarningsCalculatorCard from "../components/pandit/EarningsCalculatorCard";
import WhyJoinMyYajmaan from "../components/pandit/WhyJoinMyYajmaan";
import { showError, showSuccess } from "../utils/toaster";
import { isValidEmail, sanitizeInput } from "../utils/validation";
import { useAuth } from "../context/AuthContext";
import { optimizedImage } from "../utils/image";

function readableError(error) {
  const detail = error?.data?.detail;
  if (detail?.message) return detail.message;
  if (typeof detail === "string") return detail;
  if (error?.status === 401) return "Your Pandit Ji email or password is incorrect.";
  return error?.message || "Pandit Ji login failed. Please try again.";
}

export default function PanditLoginPage() {
  const navigate = useNavigate();
  const { applyLogin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // A bulk-uploaded Pandit Ji's first login (or one right after admin
  // resets their password) authenticates fine but isn't given a real
  // session -- the backend returns must_change_password instead, and
  // this page switches into a "set a new password" step rather than
  // signing them in.
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    const cleanEmail = sanitizeInput(email).toLowerCase();
    if (!cleanEmail || !isValidEmail(cleanEmail)) return showError("Please enter a valid email address.");
    if (!password) return showError("Please enter your password.");

    setLoading(true);
    try {
      const result = await post("/auth/login", { email: cleanEmail, password, portal: "pandit" });

      if (result?.must_change_password) {
        setMustChangePassword(true);
        return;
      }

      if (!result?.user) throw new Error("Your account profile could not be loaded.");
      applyLogin(result.user);
      showSuccess("Pandit Ji login successful. Welcome back!");
      navigate("/pandit");
    } catch (error) {
      // Self-registered account whose one-time email + phone
      // verification isn't finished yet -- send them to finish it.
      if (error?.code === "VERIFICATION_REQUIRED") {
        showError(error.message);
        navigate("/verify-otp", { state: { email: cleanEmail, portal: "pandit" } });
        return;
      }
      showError(readableError(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleSetNewPassword(event) {
    event.preventDefault();

    if (newPassword.length < 6) return showError("Password must contain at least 6 characters.");
    if (newPassword !== confirmNewPassword) return showError("Passwords do not match.");

    setLoading(true);
    try {
      await post("/auth/set-new-password", { new_password: newPassword });
      showSuccess("Password updated. Please log in again with your new password.");
      setMustChangePassword(false);
      setPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (error) {
      showError(readableError(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <FullScreenLoader open={loading} message={mustChangePassword ? "Updating your password..." : "Signing in as Pandit Ji..."} />

      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <div className="grid overflow-hidden rounded-[2rem] border border-amber-100 bg-white shadow-sm lg:grid-cols-[0.95fr_1.05fr]">
          <div className="relative min-h-[300px] overflow-hidden bg-parchment-100 p-7 sm:p-9 lg:min-h-[560px]">
            <div className="absolute inset-0 bg-gradient-to-br from-parchment-100 via-parchment-50 to-sand-pale" />
            <div className="relative flex h-full flex-col justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-saffron">Pandit Ji portal</p>
                <h1 className="mt-3 font-serif text-3xl font-semibold leading-tight text-maroon sm:text-4xl">Welcome back, Pandit Ji</h1>
                <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">Manage your profile and serve more families through MyYajmaan.</p>
              </div>
              <img loading="lazy" decoding="async" src={optimizedImage("/images/panditJoin.png")} alt="Pandit Ji" className="mx-auto mt-8 h-52 w-full max-w-sm object-contain lg:h-64" />
            </div>
          </div>

          <div className="p-6 sm:p-9 lg:p-10">
            {mustChangePassword ? (
              <>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-saffron">Pandit Ji account</p>
                <h2 className="mt-2 font-serif text-3xl font-semibold text-maroon">Set a new password</h2>
                <p className="mt-2 text-sm text-slate-600">
                  You signed in with a temporary password. Choose a new password to continue -- you'll be asked to
                  log in again with it once it's set.
                </p>

                <form onSubmit={handleSetNewPassword} className="mt-7 grid gap-4" noValidate>
                  <input
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    type="password"
                    autoComplete="new-password"
                    placeholder="New password"
                    disabled={loading}
                    className="w-full rounded-xl border border-amber-100 px-4 py-3 outline-none focus:border-amber-400 disabled:bg-slate-50"
                  />
                  <input
                    value={confirmNewPassword}
                    onChange={(event) => setConfirmNewPassword(event.target.value)}
                    type="password"
                    autoComplete="new-password"
                    placeholder="Confirm new password"
                    disabled={loading}
                    className="w-full rounded-xl border border-amber-100 px-4 py-3 outline-none focus:border-amber-400 disabled:bg-slate-50"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="interactive-button mt-3 rounded-full bg-maroon px-6 py-3 font-semibold text-white hover:bg-maroon disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Set password
                  </button>
                </form>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-saffron">Pandit Ji account</p>
                <h2 className="mt-2 font-serif text-3xl font-semibold text-maroon">Sign in</h2>
                <p className="mt-2 text-sm text-slate-600">Log in to view your Pandit Ji dashboard and registration status.</p>

                <form onSubmit={handleSubmit} className="mt-7 grid gap-4" noValidate>
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    autoComplete="email"
                    placeholder="Email address"
                    disabled={loading}
                    className="w-full rounded-xl border border-amber-100 px-4 py-3 outline-none focus:border-amber-400 disabled:bg-slate-50"
                  />
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    autoComplete="current-password"
                    placeholder="Password"
                    disabled={loading}
                    className="w-full rounded-xl border border-amber-100 px-4 py-3 outline-none focus:border-amber-400 disabled:bg-slate-50"
                  />
                  <div className="text-right">
                    <Link to="/forgot-password" title="Reset your password" className="text-sm font-semibold text-maroon hover:text-saffron">
                      Forgot password?
                    </Link>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="interactive-button mt-3 rounded-full bg-maroon px-6 py-3 font-semibold text-white hover:bg-maroon disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Login as Pandit Ji
                  </button>
                </form>

                <p className="mt-5 text-center text-sm text-slate-600">
                  New Pandit Ji?{" "}
                  <Link to="/pandit/register" title="Register as a new Pandit Ji" className="font-semibold text-maroon hover:text-saffron">
                    Register here
                  </Link>
                </p>
                <p className="mt-2 text-center text-sm">
                  <Link to="/login" title="Go to customer login" className="text-slate-500 hover:text-maroon">
                    Customer login
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Form first, so it's what opens on screen; the info follows. */}
      {!mustChangePassword && (
        <>
          <section className="mx-auto max-w-3xl px-4 pb-6 sm:px-6 lg:px-8 lg:pb-10">
            <EarningsCalculatorCard ctaLabel="New Pandit Ji? Register Now →" />
          </section>

          <section className="mx-auto max-w-6xl px-4 pb-6 sm:px-6 lg:px-8 lg:pb-10">
            <WhyJoinMyYajmaan ctaLabel="New Pandit Ji? Register Now →" />
          </section>
        </>
      )}
    </>
  );
}
