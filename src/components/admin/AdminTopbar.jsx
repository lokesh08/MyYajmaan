import { useEffect, useState } from "react";

import { ADMIN_BASE_PATH } from "../../constants/adminRoutes";
import NotificationBell from "../notifications/NotificationBell";

export default function AdminTopbar({ adminName, onMenuClick }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-100 bg-white px-4 py-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Toggle menu"
          className="interactive-button rounded-lg border border-amber-200 p-2 text-maroon md:hidden"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
          </svg>
        </button>

        <div>
          <p className="font-serif text-lg font-semibold text-maroon sm:text-xl">Welcome, {adminName} 👋</p>
          <p className="text-xs text-slate-500 sm:text-sm">Here's what's happening today</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell theme="light" inboxPath={`${ADMIN_BASE_PATH}/messages`} />

        <div className="rounded-full border border-amber-100 bg-cream px-4 py-2 text-xs font-medium text-slate-600 sm:text-sm">
          {now.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}
          {" · "}
          {now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </div>
      </div>
    </header>
  );
}
