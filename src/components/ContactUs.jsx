import { useEffect, useState } from "react";

import { withAbortGet, withAbortPost } from "../api";
import { showError, showSuccess } from "../utils/toaster";
import { isValidEmail, isValidPhone, sanitizeInput, validate } from "../utils/validation";
import FullScreenLoader from "./common/FullScreenLoader";
import { useAuth } from "../context/AuthContext";
import { optimizedImage } from "../utils/image";

const bannerImage = optimizedImage("/images/banners/banner3.png");

function getReadableError(error) {
  if (!error || error.isCanceled || error.name === "CanceledError") {
    return error?.isCanceled || error?.name === "CanceledError" ? null : "We could not send your message. Please try again.";
  }

  const responseData = error?.data || error?.response?.data || null;
  const detail = responseData?.detail;

  if (typeof detail === "object" && detail?.message) return detail.message;
  if (typeof detail === "string") return detail;
  if (responseData?.message) return responseData.message;
  if (error.message && !error.message.startsWith("{")) return error.message;

  return "We could not send your message. Please check your details and try again.";
}

export default function ContactUs() {
  const { profile } = useAuth();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [captcha, setCaptcha] = useState(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [loadingCaptcha, setLoadingCaptcha] = useState(true);

  function loadCaptcha() {
    setLoadingCaptcha(true);
    const { promise, controller } = withAbortGet("/contact/captcha");
    promise
      .then((data) => setCaptcha(data))
      .catch((error) => {
        if (!error?.isCanceled && error?.name !== "CanceledError") {
          showError("We could not load the security check. Please refresh the page.");
        }
      })
      .finally(() => setLoadingCaptcha(false));
    return controller;
  }

  useEffect(() => {
    const controller = loadCaptcha();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!profile) return;

    const nameParts = (profile.full_name || "").trim().split(/\s+/).filter(Boolean);
    const firstName = profile.first_name || nameParts.shift() || "";
    const lastName = profile.last_name || nameParts.join(" ");

    setForm((current) => ({
      ...current,
      firstName: current.firstName || firstName,
      lastName: current.lastName || lastName,
      phone: current.phone || profile.phone || "",
      email: current.email || profile.email || "",
    }));
  }, [profile]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleNameChange(field, event) {
    const cleaned = (event.target.value || "")
      .replace(/<[^>]*>?/gm, "")
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
      .replace(/[^\p{L}\s'-]/gu, "");
    updateField(field, cleaned);
  }

  function handlePhoneChange(event) {
    updateField("phone", (event.target.value || "").replace(/[^\d+\s\-()]/g, ""));
  }

  function handleSubmit(event) {
    event.preventDefault();

    const fields = {
      firstName: sanitizeInput(form.firstName),
      lastName: sanitizeInput(form.lastName),
      phone: sanitizeInput(form.phone),
      email: sanitizeInput(form.email).toLowerCase(),
      message: sanitizeInput(form.message),
      captchaAnswer: sanitizeInput(captchaAnswer),
      captchaToken: captcha?.token || "",
    };

    const validationResult = validate(fields, {
      firstName: { required: true, type: "name", message: "Please enter your first name." },
      lastName: { required: true, type: "name", message: "Please enter your last name." },
      phone: { required: true, type: "phone", message: "Please enter a valid phone number." },
      email: { required: true, type: "email", message: "Please enter a valid email address." },
      message: { required: true, min: 10, max: 2000, message: "Please enter a message between 10 and 2000 characters." },
      captchaAnswer: { required: true, message: "Please answer the security check." },
    });

    if (!validationResult.valid) {
      showError(Object.values(validationResult.errors)[0] || "Please check the entered information.");
      return;
    }

    if (!isValidPhone(fields.phone) || !isValidEmail(fields.email)) {
      showError("Please enter a valid phone number and email address.");
      return;
    }

    if (!captcha?.token) {
      showError("The security check is not ready. Please try again.");
      return;
    }

    setLoading(true);
    const { promise } = withAbortPost("/contact", fields);

    promise
      .then(() => {
        showSuccess("Thank you. Your message has been sent successfully.");
        setForm({ firstName: "", lastName: "", phone: "", email: "", message: "" });
        setCaptchaAnswer("");
        loadCaptcha();
      })
      .catch((error) => {
        const message = getReadableError(error);
        if (message) showError(message);
      })
      .finally(() => setLoading(false));
  }

  return (
    <>
      <FullScreenLoader open={loading} message="Sending your message..." />

      <section className="min-h-screen bg-cream pb-14">
      <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8 lg:pt-8">
        <div className="relative isolate min-h-[330px] overflow-hidden rounded-[2rem] bg-maroon shadow-divine-lg sm:min-h-[360px] lg:min-h-[390px]">
          <img src={bannerImage} alt="A family receiving personal guidance from a Pandit Ji" className="absolute inset-0 h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-maroon-deep via-maroon/90 to-marigold-deep/65" />
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border border-amber-100/20 bg-saffron/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full border border-white/10 bg-rose-200/10 blur-3xl" />

          <div className="relative flex min-h-[330px] flex-col justify-between px-6 py-8 sm:min-h-[360px] sm:px-10 sm:py-10 lg:min-h-[390px] lg:px-16 lg:py-14">
            <div className="flex items-center gap-3 text-amber-100">
              <span className="block h-11 w-11 overflow-hidden rounded-full border border-white/25">
                <img src={optimizedImage("/images/logo-mark.png")} alt="MyYajmaan" className="h-full w-full object-cover" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.3em]">MyYajmaan support</span>
            </div>

            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-200">We are here to help</p>
              <h1 className="mt-3 max-w-xl font-serif text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">Plan your sacred occasion with us.</h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-amber-50 sm:text-base">Ask about a puja, find the right Pandit Ji, or get help with your booking. Our team will get back to you with care.</p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs font-semibold text-amber-50 sm:gap-3 sm:text-sm">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-sm">Trusted guidance</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-sm">Personal support</span>
            </div>
          </div>
        </div>

        <div className="mx-auto -mt-5 max-w-4xl px-1 sm:-mt-8 sm:px-5">
          <div className="relative rounded-[1.8rem] border border-amber-100 bg-parchment-50 p-5 shadow-card-lg sm:p-8 lg:p-10">
            <div className="pointer-events-none absolute right-0 top-0 h-36 w-36 rounded-full bg-saffron/10 blur-3xl" />
            <div className="relative">
              <div className="text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-saffron">Start a conversation</p>
                <h2 className="mt-2 font-serif text-2xl font-semibold text-maroon sm:text-3xl">How can we help you?</h2>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">Fill in your details and tell us what you need. Fields marked with * are required.</p>
              </div>

              <form onSubmit={handleSubmit} className="mt-7 grid gap-4" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <input value={form.firstName} onChange={(event) => handleNameChange("firstName", event)} placeholder="First Name *" autoComplete="given-name" disabled={loading} className="rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-maroon focus:ring-2 focus:ring-amber-100 disabled:opacity-60" />
                  <input value={form.lastName} onChange={(event) => handleNameChange("lastName", event)} placeholder="Last Name *" autoComplete="family-name" disabled={loading} className="rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-maroon focus:ring-2 focus:ring-amber-100 disabled:opacity-60" />
                  <input value={form.phone} onChange={handlePhoneChange} placeholder="Phone *" autoComplete="tel" inputMode="tel" disabled={loading} className="rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-maroon focus:ring-2 focus:ring-amber-100 disabled:opacity-60" />
                  <input value={form.email} onChange={(event) => updateField("email", event.target.value)} placeholder="Email *" type="email" autoComplete="email" disabled={loading} className="rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-maroon focus:ring-2 focus:ring-amber-100 disabled:opacity-60" />
                </div>

                <textarea value={form.message} onChange={(event) => updateField("message", event.target.value)} placeholder="Message *" rows={5} disabled={loading} className="min-h-32 resize-y rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-maroon focus:ring-2 focus:ring-amber-100 disabled:opacity-60" />

                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                  <label className="block text-sm font-semibold text-maroon" htmlFor="contact-captcha">
                    Security check: {loadingCaptcha ? "Loading..." : captcha?.question || "Unavailable"}
                  </label>
                  <input id="contact-captcha" value={captchaAnswer} onChange={(event) => setCaptchaAnswer(event.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="Enter answer *" disabled={loading || loadingCaptcha} className="mt-2 w-full rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100 disabled:opacity-60" />
                </div>

                <button type="submit" disabled={loading || loadingCaptcha || !captcha} className="interactive-button mx-auto mt-2 inline-flex min-w-36 items-center justify-center rounded-full bg-maroon px-7 py-3 text-sm font-semibold text-white shadow-md hover:bg-maroon disabled:cursor-not-allowed disabled:opacity-60">
                  Send message
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
      </section>
    </>
  );
}
