import { Link } from "react-router-dom";

/**
 * Shown in place of a portal page's real content while the Pandit
 * Ji's registration isn't approved yet (nothing meaningful to manage
 * until then).
 */
export default function LockedNotice({ stage, rejectionReason }) {
  const isRejected = stage === "rejected";

  return (
    <div className="rounded-[1.5rem] border border-amber-100 bg-white p-8 text-center shadow-sm">
      <div
        className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl ${
          isRejected ? "bg-rose-50 text-rose-500" : "bg-amber-50 text-amber-500"
        }`}
      >
        {isRejected ? "⚠️" : "⏳"}
      </div>

      <h2 className="mt-4 font-serif text-xl font-semibold text-maroon">
        {isRejected ? "Registration declined" : "Available after approval"}
      </h2>

      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        {isRejected
          ? "Your registration was declined by admin. Review the note below and re-submit your documents to continue."
          : "This section unlocks once admin approves your Pandit Ji registration. We'll let you know as soon as it's reviewed."}
      </p>

      {isRejected && rejectionReason && (
        <div className="mx-auto mt-4 max-w-md rounded-2xl border border-rose-100 bg-rose-50 p-4 text-left text-sm text-rose-700">
          <p className="font-semibold">Admin's note</p>
          <p className="mt-1">{rejectionReason}</p>
        </div>
      )}

      <Link
        to="/pandit/profile"
        title={isRejected ? "Go to My Profile and re-submit documents" : "View My Profile"}
        className="interactive-button mt-6 inline-block rounded-full bg-maroon px-5 py-2.5 text-sm font-semibold text-white hover:bg-maroon"
      >
        {isRejected ? "Go to My Profile & Re-submit" : "View My Profile"}
      </Link>
    </div>
  );
}
