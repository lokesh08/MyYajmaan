import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { post } from "../api";
import { supabase, isConfigured } from "../services/supabaseClient";
import { showError, showSuccess } from "../utils/toaster";
import FullScreenLoader from "../components/common/FullScreenLoader";

// Where the emailed recovery link lands. supabase-js processes the
// link's token from the URL automatically (hash fragment or PKCE code,
// whichever the project uses) and fires PASSWORD_RECOVERY once a
// session is established from it -- we just wait for that.
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("waiting"); // waiting | ready | invalid | done
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const accessTokenRef = useRef(null);

  useEffect(() => {
    if (!isConfigured || !supabase) {
      setStatus("invalid");
      return;
    }

    let settled = false;

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session?.access_token) {
        settled = true;
        accessTokenRef.current = session.access_token;
        setStatus("ready");
      }
    });

    // The event may have already fired before this listener attached
    // (the SDK processes the URL as soon as the client is created), so
    // also check directly for an existing session.
    supabase.auth.getSession().then(({ data }) => {
      if (!settled && data?.session?.access_token) {
        settled = true;
        accessTokenRef.current = data.session.access_token;
        setStatus("ready");
      }
    });

    const timeout = setTimeout(() => {
      if (!settled) setStatus("invalid");
    }, 4000);

    return () => {
      subscription?.subscription?.unsubscribe?.();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    if (password.length < 6) {
      showError("Password must contain at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      showError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      let role = null;
      if (accessTokenRef.current) {
        try {
          const result = await post("/auth/password-reset-confirmed", {
            access_token: accessTokenRef.current,
          });
          role = result?.role;
        } catch {
          // Password itself is already updated in Supabase at this
          // point -- the audit-log call failing shouldn't block the
          // user from finishing.
        }
      }

      await supabase.auth.signOut();
      setStatus("done");
      showSuccess("Password updated. Please log in with your new password.");

      setTimeout(() => {
        navigate(role === "pandit" ? "/pandit/login" : "/login", { replace: true });
      }, 1500);
    } catch (error) {
      showError(error?.message || "Could not update your password. Please request a new reset link.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <FullScreenLoader open={submitting} message="Updating your password..." />

      <section className="mx-auto max-w-md px-4 py-12 sm:px-6">
        <div className="rounded-[2rem] border border-amber-100 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-marigold">Account</p>
          <h1 className="mt-2 font-serif text-3xl font-semibold text-maroon-dark">Reset your password</h1>

          {status === "waiting" && <p className="mt-4 text-sm text-slate-600">Checking your reset link...</p>}

          {status === "invalid" && (
            <>
              <p className="mt-4 text-sm text-slate-600">
                This reset link is invalid or has expired. Please request a new one.
              </p>
              <Link
                to="/forgot-password"
                title="Request a new reset link"
                className="interactive-button mt-6 inline-block rounded-full bg-maroon-dark px-6 py-3 text-sm font-semibold text-white hover:bg-maroon"
              >
                Request a new link
              </Link>
            </>
          )}

          {status === "ready" && (
            <form onSubmit={handleSubmit} className="mt-6 grid gap-4" noValidate>
              <label className="block">
                <span className="sr-only">New password</span>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  autoComplete="new-password"
                  placeholder="New password"
                  disabled={submitting}
                  className="w-full rounded-xl border border-amber-100 px-4 py-3 outline-none focus:border-amber-400 disabled:bg-slate-50"
                />
              </label>
              <label className="block">
                <span className="sr-only">Confirm new password</span>
                <input
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Confirm new password"
                  disabled={submitting}
                  className="w-full rounded-xl border border-amber-100 px-4 py-3 outline-none focus:border-amber-400 disabled:bg-slate-50"
                />
              </label>
              <button
                type="submit"
                disabled={submitting}
                className="interactive-button mt-2 rounded-full bg-maroon-dark px-6 py-3 font-semibold text-white hover:bg-maroon disabled:cursor-not-allowed disabled:opacity-60"
              >
                Set new password
              </button>
            </form>
          )}

          {status === "done" && (
            <p className="mt-4 text-sm text-slate-600">Redirecting you to login...</p>
          )}
        </div>
      </section>
    </>
  );
}
