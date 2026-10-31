import { Children, useCallback, useEffect, useRef, useState } from "react";
import { t } from "../../i18n";

// Shown only where there's a mouse/trackpad (a narrow desktop window):
// touch screens swipe, but a mouse can't, and the row has no visible
// scrollbar to grab otherwise.
const POINTER_ONLY = "hidden [@media(hover:hover)_and_(pointer:fine)]:flex";

/**
 * Horizontal, finger-swipeable row of cards for phone screens (native
 * scroll + CSS snap, no slider library). Each card is a bit narrower
 * than the screen so the next one peeks in, which is what tells people
 * the row scrolls. Callers show it below `sm` and keep their own grid
 * above it, e.g. <div className="sm:hidden"><SwipeRow ... /></div>.
 *
 * Bleeds into the 16px (px-4) side padding every mobile section here
 * uses, so the row runs edge to edge while the first card still lines
 * up with the content above it.
 */
export default function SwipeRow({ children, label, itemClassName = "w-[78%]" }) {
  const rowRef = useRef(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateArrows = useCallback(() => {
    const row = rowRef.current;
    if (!row) return;
    setCanPrev(row.scrollLeft > 4);
    setCanNext(row.scrollLeft + row.clientWidth < row.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    window.addEventListener("resize", updateArrows);
    return () => window.removeEventListener("resize", updateArrows);
  }, [updateArrows, children]);

  function scrollByCard(direction) {
    const row = rowRef.current;
    const card = row?.firstElementChild;
    if (!row || !card) return;
    row.scrollBy({ left: direction * (card.getBoundingClientRect().width + 12), behavior: "smooth" });
  }

  const arrowClass =
    "absolute top-1/2 z-10 h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-amber-200 bg-white/95 text-lg text-maroon shadow-sm transition hover:bg-maroon hover:text-white";

  return (
    // min-w-0: never let the row's full card width stretch a grid/flex
    // parent wider than the screen.
    <div className="relative min-w-0">
      <div
        ref={rowRef}
        role="region"
        aria-label={label}
        onScroll={updateArrows}
        className="swipe-row -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-6 pt-1"
      >
        {Children.map(children, (child) =>
          child ? (
            // Inside a scroll row the cards' usual large drop shadow would
            // be clipped into a hard band, so they get a tighter one here.
            <div className={`shrink-0 snap-start [&>*]:!shadow-[0_6px_16px_rgba(122,31,45,0.08)] ${itemClassName}`}>
              {child}
            </div>
          ) : null,
        )}
      </div>

      {canPrev && (
        <button type="button" aria-label={t("Previous")} onClick={() => scrollByCard(-1)} className={`${POINTER_ONLY} ${arrowClass} -left-2`}>
          ‹
        </button>
      )}
      {canNext && (
        <button type="button" aria-label={t("Next")} onClick={() => scrollByCard(1)} className={`${POINTER_ONLY} ${arrowClass} -right-2`}>
          ›
        </button>
      )}
    </div>
  );
}
