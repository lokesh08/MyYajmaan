import { useEffect, useState } from "react";

import {
  fixAadharIdentity,
  getAadharStatus,
  recheckAadharMatch,
  savePanditDocuments,
  sendAadharOtp,
  verifyAadharOtp,
} from "../../services/panditApi";
import { showError, showSuccess } from "../../utils/toaster";

const inputClass =
  "w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100";
const labelClass = "mb-1 block text-xs font-semibold uppercase text-slate-500";

/**
 * Aadhaar OTP authentication -- replaces the old raw front/back photo
 * upload. Shared by the onboarding wizard's Documents step and the
 * dashboard's My Profile > Documents tab, since the flow (and its
 * mismatch-recovery path) is identical in both places.
 *
 * Calls onVerified() once verification is done (verified OR admin
 * skipped it) so the parent can reveal the photo/bank-details step.
 */
export default function AadharVerificationCard({ onVerified }) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [aadharNumber, setAadharNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [debugOtp, setDebugOtp] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [fixName, setFixName] = useState("");
  const [fixPhone, setFixPhone] = useState("");
  const [aadharFrontFile, setAadharFrontFile] = useState(null);
  const [aadharBackFile, setAadharBackFile] = useState(null);

  function load() {
    setLoading(true);
    getAadharStatus()
      .then((data) => {
        setStatus(data);
        setFixName(data?.account_name || "");
        setFixPhone(data?.account_phone || "");
        // "skipped" alone isn't enough to move on when it falls back to
        // manual review -- the pandit still has to actually upload
        // their Aadhaar card images first (see aadhar_images.submitted).
        if (data?.status === "verified" || (data?.status === "skipped" && data?.aadhar_images?.submitted)) {
          onVerified?.();
        }
      })
      .catch(() => showError("Could not load your Aadhaar verification status."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSendOtp(event) {
    event.preventDefault();
    if (!/^\d{12}$/.test(aadharNumber.trim())) {
      showError("Please enter a valid 12-digit Aadhaar number.");
      return;
    }
    setSubmitting(true);
    try {
      const data = await sendAadharOtp(aadharNumber.trim());
      showSuccess(data.message);
      setDebugOtp(data.debug_otp || null);
      setStatus((current) => ({ ...current, status: "otp_sent", masked_aadhar: data.masked_aadhar }));
    } catch (error) {
      showError(error?.message || "Could not send OTP. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyOtp(event) {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp.trim())) {
      showError("Please enter the 6-digit OTP.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await verifyAadharOtp(otp.trim());
      if (result.matched) {
        showSuccess(result.message);
        onVerified?.();
      } else {
        showError(result.message);
      }
      setOtp("");
      setDebugOtp(null);
      load();
    } catch (error) {
      showError(error?.message || "Could not verify OTP. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFixAndRecheck(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await fixAadharIdentity({ fullName: fixName.trim(), phone: fixPhone.trim() });
      const result = await recheckAadharMatch();
      if (result.matched) {
        showSuccess(result.message);
        onVerified?.();
      } else {
        showError(result.message);
      }
      load();
    } catch (error) {
      showError(error?.message || "Could not update your details. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUploadAadharImages(event) {
    event.preventDefault();
    if (!aadharFrontFile || !aadharBackFile) {
      showError("Please choose both the front and back images of your Aadhaar card.");
      return;
    }
    setSubmitting(true);
    try {
      await savePanditDocuments({ aadharFront: aadharFrontFile, aadharBack: aadharBackFile });
      showSuccess("Aadhaar card submitted for admin review.");
      onVerified?.();
      load();
    } catch (error) {
      showError(error?.message || "Could not upload your Aadhaar card. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="py-6 text-center text-sm text-slate-400">Loading...</p>;
  }

  if (status?.status === "verified") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <span className="text-lg">✓</span>
        <div>
          <p className="font-semibold">Aadhaar verified</p>
          {status.masked_aadhar && <p className="text-xs text-emerald-700">Aadhaar: {status.masked_aadhar}</p>}
        </div>
      </div>
    );
  }

  if (status?.status === "skipped" && status?.aadhar_images?.submitted) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
        <span className="text-lg">✓</span>
        <p className="font-semibold">Aadhaar card submitted. Admin will review it manually before approving your profile.</p>
      </div>
    );
  }

  if (status?.status === "skipped") {
    return (
      <form onSubmit={handleUploadAadharImages} className="space-y-3">
        <p className="text-sm text-slate-600">
          OTP verification has been skipped for your account. Please upload clear photos of both sides of your
          Aadhaar card instead -- admin will review them manually.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-amber-200 bg-white p-3">
            <p className={labelClass}>Aadhaar Card (Front)</p>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setAadharFrontFile(event.target.files?.[0] || null)}
              className="w-full text-xs text-slate-500 file:mr-3 file:rounded-full file:border-0 file:bg-amber-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-maroon"
            />
            {aadharFrontFile && <p className="mt-1 truncate text-xs text-emerald-600">{aadharFrontFile.name}</p>}
          </div>
          <div className="rounded-xl border border-amber-200 bg-white p-3">
            <p className={labelClass}>Aadhaar Card (Back)</p>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setAadharBackFile(event.target.files?.[0] || null)}
              className="w-full text-xs text-slate-500 file:mr-3 file:rounded-full file:border-0 file:bg-amber-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-maroon"
            />
            {aadharBackFile && <p className="mt-1 truncate text-xs text-emerald-600">{aadharBackFile.name}</p>}
          </div>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="interactive-button rounded-full bg-maroon px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Uploading..." : "Submit Aadhaar Card"}
        </button>
      </form>
    );
  }

  if (status?.status === "mismatch") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <p className="font-semibold">Aadhaar mismatch found</p>
          <p className="mt-1">
            Aadhaar is validated, but the details on your Aadhaar don't match your MyYajmaan profile. Aadhaar
            record shows: <strong>{status.aadhar_name_on_record}</strong>
            {status.aadhar_phone_on_record ? ` / ${status.aadhar_phone_on_record}` : ""}. Correct your profile
            below to match your Aadhaar card exactly, then re-check -- no need to redo the OTP.
          </p>
        </div>

        <form onSubmit={handleFixAndRecheck} className="space-y-3 rounded-xl border border-amber-100 bg-white p-4">
          <label className="block">
            <span className={labelClass}>Full Name (as per Aadhaar)</span>
            <input value={fixName} onChange={(event) => setFixName(event.target.value)} className={inputClass} disabled={submitting} />
          </label>
          <label className="block">
            <span className={labelClass}>Mobile Number (as per Aadhaar)</span>
            <input value={fixPhone} onChange={(event) => setFixPhone(event.target.value)} className={inputClass} disabled={submitting} />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="interactive-button rounded-full bg-maroon px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Checking..." : "Save & Re-check"}
          </button>
        </form>
      </div>
    );
  }

  if (status?.status === "otp_sent") {
    return (
      <form onSubmit={handleVerifyOtp} className="space-y-3">
        <p className="text-sm text-slate-600">
          An OTP has been sent to the mobile number linked with Aadhaar {status.masked_aadhar}.
        </p>
        {debugOtp && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Demo mode -- no real SMS gateway yet. Your test OTP is <strong>{debugOtp}</strong>.
          </p>
        )}
        <label className="block max-w-xs">
          <span className={labelClass}>Enter OTP</span>
          <input
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="6-digit OTP"
            className={inputClass}
            disabled={submitting}
          />
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="interactive-button rounded-full bg-maroon px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Verifying..." : "Verify OTP"}
          </button>
          <button
            type="button"
            onClick={() => setStatus((current) => ({ ...current, status: "not_started" }))}
            disabled={submitting}
            className="interactive-button rounded-full border border-amber-200 px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-amber-50"
          >
            Use a different number
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSendOtp} className="space-y-3">
      <p className="text-sm text-slate-600">
        Enter your 12-digit Aadhaar number to verify your identity. An OTP will be sent to the mobile number
        linked with it.
      </p>
      <label className="block max-w-xs">
        <span className={labelClass}>Aadhaar Number</span>
        <input
          value={aadharNumber}
          onChange={(event) => setAadharNumber(event.target.value.replace(/\D/g, "").slice(0, 12))}
          inputMode="numeric"
          placeholder="XXXX XXXX XXXX"
          className={inputClass}
          disabled={submitting}
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="interactive-button rounded-full bg-maroon px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Sending..." : "Send OTP"}
      </button>
      <p className="text-xs text-slate-400">
        If your Aadhaar isn't linked to a mobile number, please call admin directly -- they can skip this step for
        you.
      </p>
    </form>
  );
}
