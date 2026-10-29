import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { get, withAbortPost } from "../api";
import FullScreenLoader from "../components/common/FullScreenLoader";
import EarningsCalculatorCard from "../components/pandit/EarningsCalculatorCard";
import WhyJoinMyYajmaan from "../components/pandit/WhyJoinMyYajmaan";
import { showError, showSuccess } from "../utils/toaster";
import { isValidEmail, isValidPhone, sanitizeInput, validate } from "../utils/validation";
import { optimizedImage } from "../utils/image";

const initialForm = { firstName: "", lastName: "", phone: "", email: "", state: "", city: "", password: "", confirmPassword: "" };

function readableError(error) {
  if (error?.isCanceled || error?.name === "CanceledError") return null;
  const detail = error?.data?.detail;
  if (detail?.message) return detail.message;
  if (typeof detail === "string") return detail;
  if (error?.data?.message) return error.data.message;
  return error?.message || "Pandit registration failed. Please try again.";
}

export default function PanditRegisterPage() {
  const navigate = useNavigate();
  const formCardRef = useRef(null);
  const [form, setForm] = useState(initialForm);
  const [cities, setCities] = useState([]);
  const [loadingCities, setLoadingCities] = useState(true);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { promise, controller } = (() => {
      const request = new AbortController();
      return { promise: get("/cities", { signal: request.signal }), controller: request };
    })();
    promise.then((data) => setCities(Array.isArray(data) ? data : [])).catch((error) => {
      if (!error?.isCanceled && error?.name !== "CanceledError") showError("We could not load the city list.");
    }).finally(() => setLoadingCities(false));
    return () => controller.abort();
  }, []);

  const states = useMemo(() => [...new Set(cities.map((c) => c.state))].sort(), [cities]);
  const citiesForState = useMemo(
    () => cities.filter((c) => c.state === form.state).sort((a, b) => a.name.localeCompare(b.name)),
    [cities, form.state],
  );

  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); }
  function handleName(field, event) { update(field, (event.target.value || "").replace(/<[^>]*>?/gm, "").replace(/[^\p{L}\s'-]/gu, "")); }
  function handlePhone(event) { update("phone", (event.target.value || "").replace(/[^\d+\s\-()]/g, "")); }
  function handleStateChange(value) { setForm((current) => ({ ...current, state: value, city: "" })); }

  async function handleSubmit(event) {
    event.preventDefault();
    const fields = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, key.includes("password") ? value : sanitizeInput(value)]));
    const result = validate(fields, {
      firstName: { required: true, type: "name", message: "Please enter your first name." },
      lastName: { required: true, type: "name", message: "Please enter your last name." },
      phone: { required: true, type: "phone", message: "Please enter a valid mobile number." },
      email: { required: true, type: "email", message: "Please enter a valid email address." },
      state: { required: true, message: "Please select your state." },
      city: { required: true, message: "Please select your city." },
      password: { required: true, min: 6, message: "Password must contain at least 6 characters." },
      confirmPassword: { required: true, custom: (value, values) => value === values.password || "Passwords do not match." },
    });
    if (!result.valid) return showError(Object.values(result.errors)[0]);
    if (!isValidPhone(fields.phone) || !isValidEmail(fields.email)) return showError("Please enter a valid mobile number and email address.");
    if (!agreedToTerms) return showError("Please agree to the Privacy Policy and Terms and Conditions to continue.");

    setLoading(true);
    try {
      const result = await withAbortPost("/auth/pandit/register", {
        first_name: fields.firstName,
        last_name: fields.lastName,
        phone: fields.phone,
        email: fields.email.toLowerCase(),
        state: fields.state,
        city: fields.city,
        password: fields.password,
        agreed_to_terms: agreedToTerms,
      }).promise;
      showSuccess("Pandit registration completed. Please verify your email and mobile number.");
      // One-time email + phone OTP verification comes before the
      // first login. The codes were just sent by the registration call.
      navigate("/verify-otp", {
        state: { email: fields.email.toLowerCase(), portal: "pandit", otp: result?.otp },
      });
    } catch (error) {
      const message = readableError(error);
      if (message) showError(message);
    } finally { setLoading(false); }
  }

  return (
    <>
      <FullScreenLoader open={loading} message="Creating your Pandit Ji account..." />

      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <div ref={formCardRef} className="grid overflow-hidden rounded-[2rem] border border-amber-100 bg-white shadow-sm lg:grid-cols-[0.95fr_1.05fr]">
          <div className="relative overflow-hidden bg-parchment-100 p-6 sm:min-h-[300px] sm:p-9 lg:min-h-[650px]">
            <div className="absolute inset-0 bg-gradient-to-br from-parchment-100 via-parchment-50 to-sand-pale" />
            <div className="relative flex h-full flex-col justify-between">
              <div><p className="text-xs font-semibold uppercase tracking-[0.25em] text-saffron">Join MyYajmaan</p><h1 className="mt-3 max-w-md font-serif text-3xl font-semibold leading-tight text-maroon sm:text-4xl">Become a Pandit Ji</h1><p className="mt-3 max-w-md text-sm leading-6 text-slate-600">Share your seva with families looking for trusted spiritual guidance.</p></div>
              <img loading="lazy" decoding="async" src={optimizedImage("/images/panditJoin.png")} alt="Pandit Ji performing puja" className="mx-auto mt-8 hidden h-56 w-full max-w-sm object-contain sm:block lg:h-72" />
            </div>
          </div>
          <div className="p-6 sm:p-9 lg:p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-saffron">Pandit Ji registration</p>
            <h2 className="mt-2 font-serif text-3xl font-semibold text-maroon">Create your profile</h2>
            <p className="mt-2 text-sm text-slate-600">Start with your basic details. Admin approval will happen after registration.</p>
            <form onSubmit={handleSubmit} className="mt-6 grid gap-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <input aria-label="First Name" value={form.firstName} onChange={(event) => handleName("firstName", event)} placeholder="First Name *" disabled={loading} className="w-full rounded-xl border border-amber-100 px-4 py-3 outline-none focus:border-amber-400 disabled:bg-slate-50" />
                <input aria-label="Last Name" value={form.lastName} onChange={(event) => handleName("lastName", event)} placeholder="Last Name *" disabled={loading} className="w-full rounded-xl border border-amber-100 px-4 py-3 outline-none focus:border-amber-400 disabled:bg-slate-50" />
              </div>
              <p className="-mt-2 text-xs text-slate-500">
                Please enter your name exactly as it appears on your Aadhaar card -- it will be verified later. If
                you have a middle name, include it with your First Name (e.g. "Ramesh Kumar").
              </p>
              <input aria-label="Mobile Number" value={form.phone} onChange={handlePhone} placeholder="Mobile Number *" inputMode="tel" disabled={loading} className="w-full rounded-xl border border-amber-100 px-4 py-3 outline-none focus:border-amber-400 disabled:bg-slate-50" />
              <input aria-label="Email" value={form.email} onChange={(event) => update("email", event.target.value)} type="email" placeholder="Email *" disabled={loading} className="w-full rounded-xl border border-amber-100 px-4 py-3 outline-none focus:border-amber-400 disabled:bg-slate-50" />
              <div className="grid gap-4 sm:grid-cols-2">
                <select
                  value={form.state}
                  onChange={(event) => handleStateChange(event.target.value)}
                  disabled={loading || loadingCities}
                  title="Select your state"
                  aria-label="State"
                  className="w-full rounded-xl border border-amber-100 bg-white px-4 py-3 text-slate-700 outline-none focus:border-amber-400 disabled:bg-slate-50"
                >
                  <option value="">{loadingCities ? "Loading states..." : "Select State *"}</option>
                  {states.map((state) => <option key={state} value={state}>{state}</option>)}
                </select>
                <select
                  value={form.city}
                  onChange={(event) => update("city", event.target.value)}
                  disabled={loading || loadingCities || !form.state}
                  title={form.state ? "Select your city" : "Select a state first"}
                  aria-label="City"
                  className="w-full rounded-xl border border-amber-100 bg-white px-4 py-3 text-slate-700 outline-none focus:border-amber-400 disabled:bg-slate-50"
                >
                  <option value="">{form.state ? "Select City *" : "Select a state first"}</option>
                  {citiesForState.map((city) => <option key={city.id} value={city.name}>{city.name}</option>)}
                </select>
              </div>
              <input aria-label="Create Password" value={form.password} onChange={(event) => update("password", event.target.value)} type="password" placeholder="Create Password *" disabled={loading} className="w-full rounded-xl border border-amber-100 px-4 py-3 outline-none focus:border-amber-400 disabled:bg-slate-50" />
              <input aria-label="Confirm Password" value={form.confirmPassword} onChange={(event) => update("confirmPassword", event.target.value)} type="password" placeholder="Confirm Password *" disabled={loading} className="w-full rounded-xl border border-amber-100 px-4 py-3 outline-none focus:border-amber-400 disabled:bg-slate-50" />

              <label className="flex items-start gap-2 text-sm text-slate-600">
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

              <button
                type="submit"
                disabled={loading || loadingCities || !agreedToTerms}
                title={!agreedToTerms ? "Please agree to the Privacy Policy and Terms and Conditions first" : "Register as a Pandit Ji"}
                className="interactive-button mt-2 rounded-full bg-saffron px-5 py-3 font-semibold text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Register as Pandit Ji
              </button>
            </form>
            <p className="mt-5 text-center text-sm text-slate-600">Already registered? <Link to="/pandit/login" title="Go to Pandit Ji login" className="font-semibold text-maroon hover:text-saffron">Pandit Ji login</Link></p>
          </div>
        </div>
      </section>

      {/* Form first, so it's what opens on screen; the info follows,
          with buttons back up to the form. */}
      <section className="mx-auto max-w-3xl px-4 pb-6 sm:px-6 lg:px-8 lg:pb-10">
        <EarningsCalculatorCard
          ctaLabel="Register as Pandit Ji ↑"
          onCtaClick={() => formCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
        />
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-6 sm:px-6 lg:px-8 lg:pb-10">
        <WhyJoinMyYajmaan
          ctaLabel="Register as Pandit Ji ↑"
          onCtaClick={() => formCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
        />
      </section>
    </>
  );
}
