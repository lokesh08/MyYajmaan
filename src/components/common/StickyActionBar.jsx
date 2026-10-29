import { useEffect, useState } from "react";

/**
 * Phone-only bar pinned to the bottom of the screen that repeats a
 * page's main action (e.g. "Continue booking"), so it's always one tap
 * away on a long page.
 *
 * `targetRef` points at the page's own, in-flow version of that action.
 * The bar only shows while that is still further down the page: once
 * it scrolls into view the bar steps aside (no duplicate button), and
 * it stays hidden after scrolling past, so it never covers the footer.
 */
export default function StickyActionBar({ targetRef, children }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const target = targetRef.current;
    if (!target || typeof IntersectionObserver === "undefined") return undefined;

    const observer = new IntersectionObserver(([entry]) => {
      setShow(!entry.isIntersecting && entry.boundingClientRect.top > 0);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [targetRef]);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-amber-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(122,31,45,0.12)] backdrop-blur transition-transform duration-200 md:hidden ${
        show ? "translate-y-0" : "pointer-events-none invisible translate-y-full"
      }`}
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-xl items-center justify-between gap-3">{children}</div>
    </div>
  );
}
