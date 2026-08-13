import React, { useEffect, useState, useRef } from "react";
import ReferEarnModal from "./ReferEarnModal";
import MuhratModal from "./MuhratModal";
import "./modals.css";
import { withAbortGet } from "../api"; // use the withAbortGet helper

export default function HomeWithModals() {
  const [referOpen, setReferOpen] = useState(false);
  const [muhratOpen, setMuhratOpen] = useState(false);
  const [referralData, setReferralData] = useState(null);
  const [muhrat, setMuhrat] = useState(null);

  // keep refs to controllers so we can abort on unmount
  const referralControllerRef = useRef(null);
  const muhratControllerRef = useRef(null);

  useEffect(() => {
    // Referral request
    const { promise: referralPromise, controller: referralController } = withAbortGet("/referral");
    referralControllerRef.current = referralController;

    referralPromise
      .then((data) => {
        setReferralData(data);
      })
      .catch((err) => {
        if (err?.name === "CanceledError" || err?.isCanceled) {
          // aborted - ignore
          return;
        }
        // fallback sample
        setReferralData({
          code: "SHUBHALABHA25",
          signupReward: "₹25",
          bookingReward: "₹51",
          earnings: "₹76.00",
          totalEarned: "₹936.00",
          shareUrl: window.location.origin,
        });
      });

    // Muhrat request
    const { promise: muhratPromise, controller: muhratController } = withAbortGet("/muhrat/next");
    muhratControllerRef.current = muhratController;

    muhratPromise
      .then((data) => {
        setMuhrat(data);
      })
      .catch((err) => {
        if (err?.name === "CanceledError" || err?.isCanceled) {
          // aborted - ignore
          return;
        }
        // fallback: no active muhrat
        setMuhrat({ active: false });
      });

    return () => {
      // cleanup: abort both requests if still in-flight
      try {
        referralControllerRef.current?.abort();
      } catch (e) { /* ignore */ }
      try {
        muhratControllerRef.current?.abort();
      } catch (e) { /* ignore */ }
      referralControllerRef.current = null;
      muhratControllerRef.current = null;
    };
  }, []);

  const muhratActive = muhrat && muhrat.active;

  return (
    <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr_1fr]">
      <div className="rounded-[1rem] border border-amber-100 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-saffron">
          Today's Shubh Muhurat
        </p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div>
            <p className="text-2xl font-bold text-maroon">03:25:16</p>
            <p className="text-sm text-slate-500">Offer ends in 1 hr</p>
          </div>
          <button
            type="button"
            aria-label="View today muhurat offer"
            className="rounded-full bg-maroon px-4 py-2 text-sm font-semibold text-white"
            onClick={() => muhratActive && setMuhratOpen(true)}
            disabled={!muhratActive}
          >
            {muhratActive ? "View Muhurat" : "No Shubh Muhurat"}
          </button>
        </div>
      </div>

      <div className="rounded-[1rem] border border-amber-100 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-saffron">
          Refer & Earn
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Invite friends and earn ₹51 for every successful booking.
        </p>
        <button
          type="button"
          aria-label="Refer and earn rewards"
          className="mt-3 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-maroon"
          onClick={() => setReferOpen(true)}
        >
          Refer Now
        </button>
      </div>

      <div className="rounded-[1rem] border border-amber-100 bg-white p-4 shadow-sm">
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