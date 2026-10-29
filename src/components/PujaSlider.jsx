import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { withAbortGet } from "../api";
import { bookingFallbackImage } from "../constants/visualAssets";
import Loader from "./common/Loader";
import SwipeRow from "./common/SwipeRow";
import { optimizedImage } from "../utils/image";

const DESKTOP_WINDOW = 4;

function PujaCard({ puja, selectedPandit }) {
  const navigate = useNavigate();
  const image = puja.thumbnail_url || puja.image_url || bookingFallbackImage;

  function handleBook() {
    navigate("/book/datetime", {
      state: {
        puja: { id: puja.id, title: puja.title, image },
        selectedPandit: selectedPandit || undefined,
      },
    });
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[1.25rem] border border-amber-200 bg-white shadow-card">
      <div className="relative h-40 overflow-hidden">
        <img loading="lazy" decoding="async" src={optimizedImage(image)} alt={puja.title} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 text-white">
          <p className="font-serif text-base font-semibold leading-tight">{puja.title}</p>
          {puja.duration_minutes ? (
            <p className="text-xs text-amber-100">{puja.duration_minutes} mins</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">From</span>
          <span className="font-semibold text-maroon">
            {puja.base_price ? `₹${puja.base_price}` : "-"}
          </span>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => navigate(`/book/${puja.id}`)}
            className="interactive-button flex-1 rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-maroon hover:text-maroon"
          >
            View
          </button>
          <button
            type="button"
            onClick={handleBook}
            className="interactive-button flex-1 rounded-full bg-maroon px-3 py-1.5 text-xs font-semibold text-white hover:bg-maroon"
          >
            Book
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Reusable puja slider — Trending Pujas / Featured Pujas on the Home
 * page, and "Pujas by this Pandit Ji" on the pandit detail page all
 * use this same component, just pointed at a different endpoint.
 */
export default function PujaSlider({
  title,
  subtitle,
  fetchUrl,
  fetchParams,
  viewAllLink,
  emptyMessage = "No pujas available right now.",
  selectedPandit,
  limit = 8,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const { promise, controller } = withAbortGet(fetchUrl, {
      params: { limit, ...fetchParams },
    });

    setLoading(true);
    setActiveIndex(0);

    promise
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch((err) => {
        if (err?.isCanceled || err?.name === "CanceledError") return;
        setItems([]);
      })
      .finally(() => setLoading(false));

    return () => {
      try {
        controller.abort();
      } catch (_) {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchUrl, JSON.stringify(fetchParams)]);

  if (loading) {
    return (
      <div>
        {title && <h2 className="font-serif text-2xl font-semibold text-maroon">{title}</h2>}
        <div className="mt-4">
          <Loader variant="card" count={4} />
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div>
        {title && <h2 className="font-serif text-2xl font-semibold text-maroon">{title}</h2>}
        <p className="mt-4 rounded-2xl border border-dashed border-amber-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
          {emptyMessage}
        </p>
      </div>
    );
  }

  const total = items.length;
  const canSlide = total > DESKTOP_WINDOW;

  function goTo(index) {
    setActiveIndex((index + total) % total);
  }

  const desktopItems = canSlide
    ? Array.from({ length: DESKTOP_WINDOW }, (_, offset) => items[(activeIndex + offset) % total])
    : items;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {title && <h2 className="font-serif text-2xl font-semibold text-maroon">{title}</h2>}
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2">
          {viewAllLink && (
            <a href={viewAllLink} title="View all pujas" className="text-sm font-semibold text-saffron">
              View All
            </a>
          )}
          {canSlide && (
            <div className="hidden items-center gap-2 sm:flex">
              <button
                type="button"
                onClick={() => goTo(activeIndex - 1)}
                aria-label="Previous puja"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-200 bg-white text-maroon transition hover:bg-maroon hover:text-white"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => goTo(activeIndex + 1)}
                aria-label="Next puja"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-200 bg-white text-maroon transition hover:bg-maroon hover:text-white"
              >
                ›
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile: swipeable row of every card */}
      <div className="mt-4 sm:hidden">
        <SwipeRow label={title || "Pujas"}>
          {items.map((puja) => (
            <PujaCard key={puja.id} puja={puja} selectedPandit={selectedPandit} />
          ))}
        </SwipeRow>
      </div>

      {/* Desktop: windowed grid of DESKTOP_WINDOW cards */}
      <div className="mt-4 hidden gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-4">
        {desktopItems.map((puja) => (
          <PujaCard key={puja.id} puja={puja} selectedPandit={selectedPandit} />
        ))}
      </div>

      {canSlide && (
        <div className="mt-5 hidden items-center justify-center gap-2 sm:flex">
          {items.map((puja, index) => (
            <button
              key={puja.id}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Show puja ${index + 1}`}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                index === activeIndex ? "w-7 bg-saffron" : "w-2.5 bg-amber-200 hover:bg-amber-400"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
