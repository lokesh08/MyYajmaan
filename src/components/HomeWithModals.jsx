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
        <div className="mt-2 flex items-center justify-between gap-3">
          <div>
            <p className="text-2xl font-bold text-maroon">
              {muhratActive && countdown != null ? formatCountdown(countdown) : "--:--:--"}
            </p>
            <p className="text-sm text-slate-500">
              {muhratActive ? `Offer ends soon — ${muhrat.title}` : "No active offer right now"}
            </p>
          </div>
          <button
            type="button"
            aria-label="View today muhurat offer"
            className="interactive-button rounded-full bg-maroon px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => muhratActive && setMuhratOpen(true)}
            disabled={!muhratActive}
          >
            {muhratActive ? "View Muhurat" : "No Shubh Muhurat"}
          </button>
        </div>
      </div>

      <div className="rounded-[1rem] border border-amber-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-saffron">
          Refer & Earn
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Invite friends and earn ₹51 for every successful booking.
        </p>
        <button
          type="button"
          aria-label="Refer and earn rewards"
          className="interactive-button mt-3 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-maroon"
          onClick={handleReferNow}
        >
          Refer Now
        </button>
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
