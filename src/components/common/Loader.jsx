import React from "react";

/**
 * Generic Loader
 *
 * Props:
 * - variant: "inline" | "card" | "spinner" (controls visuals). Default "inline".
 * - count: number of placeholder items to render (used for "card" variant). Default 4.
 * - className: extra classes applied to the wrapper.
 *
 * Tailwind is used for styling; adjust classes to match your design system.
 */
export default function Loader({ variant = "inline", count = 4, className = "" }) {
  if (variant === "spinner") {
    return (
      <div role="status" aria-busy="true" className={`flex items-center justify-center ${className}`}>
        <svg
          className="h-6 w-6 animate-spin text-maroon"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div className={`grid gap-3 sm:grid-cols-2 ${className}`}>
        {Array.from({ length: Math.max(1, count) }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse overflow-hidden rounded-[1rem] border border-amber-100 bg-white p-0"
            aria-hidden="true"
          >
            <div className="h-24 bg-amber-100" />
            <div className="p-3">
              <div className="mb-2 h-3 w-3/5 rounded bg-amber-100" />
              <div className="h-2 w-2/5 rounded bg-amber-50" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // inline or default: small inline skeleton
  return (
    <div role="status" aria-busy="true" className={`flex items-center justify-center py-4 ${className}`}>
      <div className="flex items-center gap-2">
        <div className="h-3 w-3 animate-pulse rounded-full bg-gray-300" />
        <div className="h-3 w-3 animate-pulse rounded-full bg-gray-300" />
        <div className="h-3 w-3 animate-pulse rounded-full bg-gray-300" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}