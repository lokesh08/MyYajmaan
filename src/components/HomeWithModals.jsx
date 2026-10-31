import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ReferEarnModal from "./ReferEarnModal";
import MuhratModal from "./MuhratModal";
import "./modals.css";
import { withAbortGet } from "../api"; // use the withAbortGet helper
import { useAuth } from "../context/AuthContext";
import { showInfo } from "../utils/toaster";

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
      showInfo("Please log in to refer a friend and earn rewards.");
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
      <div className="rounded-[1rem] border border-amber-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-saffron">
          Today's Shubh Muhurat
        </p>
        {muhratActive ? (
          <div className="mt-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-2xl font-bold text-maroon">
                {countdown != null ? formatCountdown(countdown) : "--:--:--"}
              </p>
              <p className="text-sm text-slate-500">{`Offer ends soon — ${muhrat.title}`}</p>
            </div>
            <button
              type="button"
              aria-label="View today muhurat offer"
              className="interactive-button min-h-[44px] rounded-full bg-maroon px-4 py-2 text-sm font-semibold text-white"
              onClick={() => setMuhratOpen(true)}
            >
              View Muhurat
            </button>
          </div>
        ) : (
          // No offer running: say so plainly and keep the card useful,
          // instead of a blank "--:--:--" timer and a disabled button.
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              {muhrat ? "No special muhurat offer today. Every day is auspicious for a puja." : "Checking today's muhurat…"}
            </p>
            {muhrat && (
              <button
                type="button"
                className="interactive-button min-h-[44px] shrink-0 rounded-full bg-maroon px-4 py-2 text-sm font-semibold text-white"
                onClick={() => navigate("/book")}
              >
                Book a Puja
              </button>
            )}
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
            Refer & Earn
            <span className="rounded-full bg-gold px-2 py-0.5 text-[11px] font-bold tracking-normal text-maroon-dark">BONUS</span>
          </p>
          <p className="mt-1 pr-14 font-serif text-xl font-semibold leading-snug">Invite friends, earn wallet cash</p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-sm">
              <p className="text-lg font-bold text-gold">{rewards.signupReward}</p>
              <p className="text-xs leading-4 text-amber-50">when your friend signs up</p>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-sm">
              <p className="text-lg font-bold text-gold">{rewards.bookingReward}</p>
              <p className="text-xs leading-4 text-amber-50">on their first puja booking</p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Refer and earn rewards"
            className="interactive-button mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-gold to-sand px-4 py-2 text-sm font-bold text-maroon-dark shadow-md transition hover:shadow-lg"
            onClick={handleReferNow}
          >
            Refer Now & Earn
            <span aria-hidden="true">→</span>
          </button>
          <p className="mt-2 text-center text-xs text-amber-100/90">Share your link · Friend joins · You both earn</p>
        </div>
      </div>

      <div className="rounded-[1rem] border border-amber-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-saffron">
          Why families choose us
        </p>
        <ul className="mt-2 space-y-2 text-sm text-slate-600">
          <li>• On-time puja service</li>
          <li>• Transparent pricing</li>
          <li>• Easy booking and support</li>
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
