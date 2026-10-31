import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import ReferEarnModal from "./ReferEarnModal";
import MuhratModal from "./MuhratModal";
import "./modals.css";
import { withAbortGet } from "../api"; // use the withAbortGet helper
import { useAuth } from "../context/AuthContext";
import { showInfo } from "../utils/toaster";
import { getLanguage, t } from "../i18n";

// "Why families choose us" -- icon, title, one line of detail.
const PROMISES = [
  { icon: "🕉️", title: "On-time puja service", detail: "Pandit Ji reaches before the muhurat, every time." },
  { icon: "🛡️", title: "Verified Pandit Ji", detail: "Aadhaar-checked and approved by our team." },
  { icon: "💰", title: "Transparent pricing", detail: "Full price breakup before you pay – no surprises." },
  { icon: "🤝", title: "Easy booking and support", detail: "Book in a few taps, help whenever you need it." },
];

// Whole days from today (local) to a YYYY-MM-DD date.
function daysUntil(dateStr) {
  const [y, m, d] = String(dateStr || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((new Date(y, m - 1, d) - start) / 86400000);
}

function whenLabel(days) {
  if (days === 0) return t("today");
  if (days === 1) return t("tomorrow");
  return t("in {days} days", { days });
}

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
  // Next few festivals for the muhurat card's "Coming up" list.
  const [festivals, setFestivals] = useState([]);

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
    const { promise, controller } = withAbortGet("/festivals", { params: { limit: 2 } });
    promise.then((data) => setFestivals(Array.isArray(data) ? data.slice(0, 2) : [])).catch(() => {});
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
    <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr_1fr]">
      <div className="flex flex-col rounded-[1rem] border border-amber-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-saffron">
          {t("Today's Shubh Muhurat")}
        </p>
        {muhratActive ? (
          <div className="mt-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-2xl font-bold text-maroon">
                {countdown != null ? formatCountdown(countdown) : "--:--:--"}
              </p>
              <p className="text-sm text-slate-500">{t("Offer ends soon — {title}", { title: muhrat.title })}</p>
            </div>
            <button
              type="button"
              aria-label={t("View today muhurat offer")}
              className="interactive-button min-h-[44px] rounded-full bg-maroon px-4 py-2 text-sm font-semibold text-white"
              onClick={() => setMuhratOpen(true)}
            >
              {t("View Muhurat")}
            </button>
          </div>
        ) : (
          // No offer running: say so plainly and keep the card useful,
          // instead of a blank "--:--:--" timer and a disabled button.
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              {muhrat ? t("No special muhurat offer today. Every day is auspicious for a puja.") : t("Checking today's muhurat…")}
            </p>
            {muhrat && (
              <button
                type="button"
                className="interactive-button min-h-[44px] shrink-0 rounded-full bg-maroon px-4 py-2 text-sm font-semibold text-white"
                onClick={() => navigate("/book")}
              >
                {t("Book a Puja")}
              </button>
            )}
          </div>
        )}

        {/* Coming up: the next festivals, each a shortcut into booking. */}
        {festivals.length > 0 && (
          <div className="mt-4 border-t border-amber-100 pt-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t("Coming up")}</p>
            <ul className="mt-2 space-y-2">
              {festivals.map((festival) => {
                const days = daysUntil(festival.start_date);
                const date = festival.start_date ? new Date(`${festival.start_date}T00:00:00`) : null;
                const locale = getLanguage() === "hi" ? "hi-IN" : "en-IN";
                return (
                  <li key={festival.id || festival.title}>
                    <Link
                      to="/book"
                      title={t("Book for this festival")}
                      className="group flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50/40 p-2 transition hover:border-saffron hover:bg-amber-50"
                    >
                      {date && (
                        <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-gradient-to-b from-maroon to-maroon-deep text-white shadow-sm">
                          <span className="text-base font-bold leading-none">{date.getDate()}</span>
                          <span className="text-[10px] uppercase leading-tight text-amber-100">
                            {date.toLocaleDateString(locale, { month: "short" })}
                          </span>
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-maroon">{festival.title}</span>
                        {days != null && days >= 0 && (
                          <span className="text-xs font-medium text-saffron">{whenLabel(days)}</span>
                        )}
                      </span>
                      <span aria-hidden="true" className="text-saffron transition group-hover:translate-x-0.5">→</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Refer & Earn is a headline feature, so this card stands out from
          its two neighbours: brand gradient, gold CTA, both rewards. */}
      <div className="relative overflow-hidden rounded-[1rem] bg-gradient-to-br from-maroon-deep via-maroon to-marigold p-4 text-white shadow-lg ring-1 ring-gold/50">
        <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-gold/25 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-6 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
        <span aria-hidden="true" className="pointer-events-none absolute right-3 top-2 text-5xl opacity-90 drop-shadow-lg">
          🎁
        </span>

        <div className="relative">
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-gold">
            {t("Refer & Earn")}
            <span className="rounded-full bg-gold px-2 py-0.5 text-[11px] font-bold tracking-normal text-maroon-dark">{t("BONUS")}</span>
          </p>
          <p className="mt-1 pr-14 font-serif text-xl font-semibold leading-snug">{t("Invite friends, earn wallet cash")}</p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-sm">
              <p className="text-lg font-bold text-gold">{rewards.signupReward}</p>
              <p className="text-xs leading-4 text-amber-50">{t("when your friend signs up")}</p>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-sm">
              <p className="text-lg font-bold text-gold">{rewards.bookingReward}</p>
              <p className="text-xs leading-4 text-amber-50">{t("on their first puja booking")}</p>
            </div>
          </div>

          <button
            type="button"
            aria-label={t("Refer and earn rewards")}
            className="interactive-button mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-gold to-sand px-4 py-2 text-sm font-bold text-maroon-dark shadow-md transition hover:shadow-lg"
            onClick={handleReferNow}
          >
            {t("Refer Now & Earn")}
            <span aria-hidden="true">→</span>
          </button>
          <p className="mt-2 text-center text-xs text-amber-100/90">{t("Share your link · Friend joins · You both earn")}</p>
        </div>
      </div>

      <div className="rounded-[1rem] border border-amber-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-saffron">
          {t("Why families choose us")}
        </p>
        <ul className="mt-3 space-y-3">
          {PROMISES.map((item) => (
            <li key={item.title} className="flex items-start gap-3">
              <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-50 to-amber-100 text-lg ring-1 ring-amber-200">
                {item.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-maroon">{t(item.title)}</span>
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
