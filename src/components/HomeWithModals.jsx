import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import ReferEarnModal from "./ReferEarnModal";
import MuhratModal from "./MuhratModal";
import "./modals.css";
import { withAbortGet } from "../api"; // use the withAbortGet helper
import { useAuth } from "../context/AuthContext";
import { showInfo } from "../utils/toaster";
import { t } from "../i18n";
import { clearBookingDraft } from "../utils/bookingFlowStorage";

// "Search & Book Pujas Easily" -- the booking steps, each opens Book Puja.
const BOOKING_STEPS = [
  { icon: "🛕", label: "Choose a Puja or Occasion" },
  { icon: "🗓️", label: "Select Date & Time" },
  { icon: "✅", label: "Complete Your Payment & Get Confirmed" },
];

// "Why Choose Our Pandit Ji" -- icon, title, one line of detail.
const PROMISES = [
  { icon: "🛡️", title: "Verified & Experienced", detail: "Our Pandit Ji are profile verified and experienced." },
  { icon: "₹", title: "Fair & Transparent Pricing", detail: "No hidden charges, clear dakshina and puja cost." },
  { icon: "📱", title: "Convenient Booking", detail: "Book online anytime, from anywhere." },
  { icon: "🎧", title: "Easy Booking & Support", detail: "Get help from our support team whenever you need." },
];

function formatCountdown(ms) {
  if (ms <= 0) return "00:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export default function HomeWithModals() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [referOpen, setReferOpen] = useState(false);
  const [muhratOpen, setMuhratOpen] = useState(false);
  const [referralData, setReferralData] = useState(null);
  const [muhrat, setMuhrat] = useState(null);
  const [countdown, setCountdown] = useState(null);
  // Admin-configured referral amounts (public); fallbacks until loaded.
  const [rewards, setRewards] = useState({ signupReward: "₹25", bookingReward: "₹51" });

  // keep refs to controllers so we can abort on unmount
  const muhratControllerRef = useRef(null);

  function loadMuhrat() {
    const { promise, controller } = withAbortGet("/muhrat/next");
    muhratControllerRef.current = controller;

    promise
      .then((data) => setMuhrat(data))
      .catch((err) => {
        if (err?.name === "CanceledError" || err?.isCanceled) return;
        setMuhrat({ active: false });
      });
  }

  useEffect(() => {
    const { promise, controller } = withAbortGet("/referral/rewards");
    promise
      .then((data) => {
        setRewards((current) => ({
          signupReward: data?.signupReward && data.signupReward !== "—" ? data.signupReward : current.signupReward,
          bookingReward: data?.bookingReward && data.bookingReward !== "—" ? data.bookingReward : current.bookingReward,
        }));
      })
      .catch(() => {});
    return () => {
      try {
        controller?.abort();
      } catch {
        /* ignore */
      }
    };
  }, []);

  useEffect(() => {
    loadMuhrat();

    return () => {
      try {
        muhratControllerRef.current?.abort();
      } catch (e) {
        /* ignore */
      }
      muhratControllerRef.current = null;
    };
  }, []);

  // Live countdown to the active muhurat's end time.
  useEffect(() => {
    if (!muhrat?.active || !muhrat?.end_at) {
      setCountdown(null);
      return;
    }

    const endTime = new Date(muhrat.end_at).getTime();

    function tick() {
      const remaining = endTime - Date.now();
      if (remaining <= 0) {
        setCountdown(null);
        loadMuhrat(); // refresh — this muhurat just ended
        return;
      }
      setCountdown(remaining);
    }

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [muhrat?.active, muhrat?.end_at]);

  function handleReferNow() {
    if (!isAuthenticated) {
      showInfo(t("Please log in to refer a friend and earn rewards."));
      navigate("/login");
      return;
    }

    const { promise } = withAbortGet("/referral");
    promise
      .then((data) => {
        setReferralData(data);
        setReferOpen(true);
      })
      .catch((err) => {
        if (err?.isCanceled || err?.name === "CanceledError") return;
        setReferralData(null);
        setReferOpen(true);
      });
  }

  const muhratActive = muhrat && muhrat.active;

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {/* 1. Search & Book Pujas Easily (+ the Shubh Muhurat offer when one is live) */}
      <div className="flex flex-col rounded-[1.1rem] border border-amber-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-serif text-lg font-semibold text-maroon">{t("Search & Book Pujas Easily")}</h2>
            <p className="mt-1 text-sm leading-5 text-slate-500">{t("Find popular poojas for home, family, career, health and more in a few clicks.")}</p>
          </div>
          <Link
            to="/book"
            onClick={clearBookingDraft}
            className="interactive-button inline-flex min-h-[40px] shrink-0 items-center gap-1 rounded-full bg-maroon px-4 text-sm font-semibold text-white shadow-sm"
          >
            {t("Book a Puja")} <span aria-hidden="true">›</span>
          </Link>
        </div>

        {muhratActive && (
          <button
            type="button"
            onClick={() => setMuhratOpen(true)}
            aria-label={t("View today muhurat offer")}
            className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50 to-white px-3 py-2 text-left"
          >
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-saffron">🪔 {t("Shubh Muhurat offer live")}</span>
              <span className="block truncate text-sm font-semibold text-maroon">{muhrat.title}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block font-mono text-sm font-bold text-maroon">{countdown != null ? formatCountdown(countdown) : ""}</span>
              <span className="text-xs font-semibold text-saffron">{t("View Muhurat")} ›</span>
            </span>
          </button>
        )}

        <ol className="mt-3 space-y-2">
          {BOOKING_STEPS.map((step) => (
            <li key={step.label}>
              <Link
                to="/book"
                onClick={clearBookingDraft}
                className="group flex min-h-[48px] items-center gap-3 rounded-xl border border-amber-100 bg-white px-2.5 py-2 transition hover:border-saffron hover:bg-amber-50/60"
              >
                <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-maroon to-maroon-deep text-base text-white shadow-sm">
                  {step.icon}
                </span>
                <span className="flex-1 text-sm font-semibold text-slate-700">{t(step.label)}</span>
                <span aria-hidden="true" className="text-saffron transition group-hover:translate-x-0.5">›</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>

      {/* 2. Refer & Earn -- a headline feature, so it stands out: brand
          gradient, gold button, both reward amounts. */}
      <div className="relative flex flex-col overflow-hidden rounded-[1.1rem] bg-gradient-to-br from-maroon-deep via-maroon to-maroon-dark p-4 text-white shadow-lg ring-1 ring-gold/40">
        <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-gold/20 blur-2xl" />
        <span aria-hidden="true" className="pointer-events-none absolute right-3 top-2 text-5xl drop-shadow-lg">
          🎁
        </span>

        <div className="relative flex flex-1 flex-col">
          <p className="flex items-center gap-2 text-sm font-semibold text-gold">
            {t("Refer & Earn")}
            <span className="rounded-full bg-gold px-2 py-0.5 text-[11px] font-bold text-maroon-dark">{t("New")}</span>
          </p>
          <p className="mt-1 pr-14 font-serif text-xl font-semibold leading-snug">{t("Invite friends, earn wallet cash")}</p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="flex items-start gap-2 rounded-xl border border-white/20 bg-white/10 px-2.5 py-2 backdrop-blur-sm">
              <span aria-hidden="true" className="text-lg">🔗</span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold leading-4 text-amber-50">{t("Share your unique referral")}</span>
                <span className="block text-sm font-bold text-gold">{t("{amount} on sign-up", { amount: rewards.signupReward })}</span>
              </span>
            </div>
            <div className="flex items-start gap-2 rounded-xl border border-white/20 bg-white/10 px-2.5 py-2 backdrop-blur-sm">
              <span aria-hidden="true" className="text-lg">💰</span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold leading-4 text-amber-50">{t("Get rewards on bookings")}</span>
                <span className="block text-sm font-bold text-gold">{t("{amount} on first booking", { amount: rewards.bookingReward })}</span>
              </span>
            </div>
          </div>

          <button
            type="button"
            aria-label={t("Refer and earn rewards")}
            className="interactive-button mt-auto inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-gold to-sand px-4 py-2 text-sm font-bold text-maroon-dark shadow-md transition hover:shadow-lg"
            style={{ marginTop: "0.9rem" }}
            onClick={handleReferNow}
          >
            {t("Invite Now & Earn")}
            <span aria-hidden="true">→</span>
          </button>
          <p className="mt-2 text-center text-xs text-amber-100/90">{t("More puja bookings by your friends = more rewards")}</p>
        </div>
      </div>

      {/* 3. Why Choose Our Pandit Ji */}
      <div className="rounded-[1.1rem] border border-amber-200 bg-white p-4 shadow-sm">
        <h2 className="font-serif text-lg font-semibold text-maroon">{t("Why Choose Our Pandit Ji")}</h2>
        <ul className="mt-3 space-y-3">
          {PROMISES.map((item) => (
            <li key={item.title} className="flex items-start gap-3">
              <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-50 to-amber-100 text-lg font-bold text-maroon ring-1 ring-amber-200">
                {item.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-800">{t(item.title)}</span>
                <span className="block text-xs leading-5 text-slate-500">{t(item.detail)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <ReferEarnModal
        open={referOpen}
        onClose={() => setReferOpen(false)}
        data={referralData}
      />
      <MuhratModal
        open={muhratOpen}
        onClose={() => setMuhratOpen(false)}
        muhrat={muhrat}
      />
    </div>
  );
}
