import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { markActivityNow } from "../../hooks/useIdleLogout";
import { adminLogin } from "../../services/adminApi";
import { showError, showSuccess } from "../../utils/toaster";
import { isValidEmail, sanitizeInput } from "../../utils/validation";
import FullScreenLoader from "../../components/common/FullScreenLoader";
import { ADMIN_DASHBOARD_PATH } from "../../constants/adminRoutes";
import { broadcastSession } from "../../utils/sessionBroadcast";
import { optimizedImage } from "../../utils/image";

function getReadableError(error) {
  if (!error || error.isCanceled || error.name === "CanceledError") return null;
  const detail = error?.data?.detail;
  if (typeof detail === "object" && detail?.message) return detail.message;
  if (typeof detail === "string") return detail;
  if (error?.status === 401) return "The email or password is incorrect.";
  if (error?.status === 403) return "This account does not have admin access.";
  return "Login failed. Please try again.";
}

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    const cleanEmail = sanitizeInput(email).toLowerCase().trim();
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
      const result = await adminLogin(cleanEmail, password);
      broadcastSession(result?.user || null);
      showSuccess("Welcome back, Admin!");
      markActivityNow();
      navigate(ADMIN_DASHBOARD_PATH, { replace: true });
    } catch (error) {
      const message = getReadableError(error);
      if (message) showError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <FullScreenLoader open={loading} message="Signing you in..." />

      <section className="flex min-h-screen items-center justify-center bg-maroon px-4">
        <div className="w-full max-w-sm rounded-[1.5rem] border border-white/10 bg-white p-8 shadow-2xl">
          <div className="mx-auto mb-4 h-12 w-12 overflow-hidden rounded-full shadow-md">
            <img src={optimizedImage("/images/logo-mark.png")} alt="MyYajmaan" className="h-full w-full object-cover" />
          </div>
          <h1 className="text-center font-serif text-2xl font-semibold text-maroon">Admin Portal</h1>
          <p className="mt-1 text-center text-sm text-slate-500">Authorized access only</p>

          <form onSubmit={handleSubmit} className="mt-6 grid gap-4" noValidate>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              type="email"
              autoComplete="username"
              disabled={loading}
              className="rounded-xl border border-amber-200 px-4 py-3 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100 disabled:opacity-60"
            />
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              type="password"
              autoComplete="current-password"
              disabled={loading}
              className="rounded-xl border border-amber-200 px-4 py-3 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading}
              className="interactive-button rounded-full bg-maroon px-5 py-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
