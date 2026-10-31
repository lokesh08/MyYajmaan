import { useEffect, useState } from "react";

import { withAbortGet } from "../api";
import Modal from "./Modal";
import Loader from "./common/Loader";
import { t } from "../i18n";

const ACCENTS = [
  "from-parchment-350 to-clay",
  "from-rosewood-light to-rosewood",
  "from-sage-light to-sage",
  "from-parchment-500 to-clay-sand",
];

function initials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Stars({ rating }) {
  return (
    <div className="flex gap-1 text-lg leading-none text-saffron" aria-label={t("{rating} out of 5 stars", { rating: rating })}>
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} aria-hidden="true">★</span>
      ))}
    </div>
  );
}

function TestimonialCard({ item, accent, onPreviewImage }) {
  return (
    <article className="group relative flex min-h-[310px] flex-col rounded-[1.5rem] border border-amber-200 bg-white p-5 shadow-card-sm transition duration-300 hover:-translate-y-2 hover:border-saffron/40 hover:shadow-card-lg sm:p-6">
      <div className="flex items-center gap-3">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${accent} font-serif text-lg font-semibold text-white shadow-inner ring-4 ring-amber-50 transition duration-300 group-hover:scale-105`}>
          {initials(item.customer_name)}
        </div>

        <div className="min-w-0">
          <h3 className="truncate font-semibold text-slate-900">
            {item.customer_name}
          </h3>
          {item.location && <p className="text-sm text-slate-500">{item.location}</p>}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="font-serif text-4xl leading-none text-amber-200">"</span>
        <Stars rating={item.rating} />
      </div>

      {item.cover_photo_url ? (
        <div className="mt-2 flex flex-1 items-start gap-3">
          <button
            type="button"
            onClick={() => onPreviewImage(item)}
            aria-label={t("View puja photo shared by {customer_name}", { customer_name: item.customer_name })}
            className="interactive-button h-20 w-20 shrink-0 overflow-hidden rounded-xl shadow-sm ring-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon"
          >
            <img loading="lazy" decoding="async"
              src={item.cover_photo_url}
              alt={t("Puja photo shared by {customer_name}", { customer_name: item.customer_name })}
              className="h-full w-full object-cover transition duration-200 hover:scale-105"
            />
          </button>
          <p className="flex-1 text-sm leading-7 text-slate-600 sm:text-[0.95rem]">
            {item.comment}
          </p>
        </div>
      ) : (
        <p className="mt-2 flex-1 text-sm leading-7 text-slate-600 sm:text-[0.95rem]">
          {item.comment}
        </p>
      )}

      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-maroon">
          {item.puja_title}
        </span>
        <span className="font-serif text-4xl leading-none text-amber-200 transition group-hover:text-saffron/50">"</span>
      </div>
    </article>
  );
}

export default function Testimonials() {
  const [testimonials, setTestimonials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [previewItem, setPreviewItem] = useState(null);

  useEffect(() => {
    const { promise, controller } = withAbortGet("/reviews/published", { params: { limit: 20 } });

    setLoading(true);

    promise
      .then((data) => setTestimonials(Array.isArray(data) ? data : []))
      .catch((err) => {
        if (err?.isCanceled || err?.name === "CanceledError") return;
        setTestimonials([]);
      })
      .finally(() => setLoading(false));

    return () => {
      try {
        controller.abort();
      } catch (_) {
        /* ignore */
      }
    };
  }, []);

  const totalSlides = testimonials.length;

  function goTo(index) {
    setActiveIndex((index + totalSlides) % totalSlides);
  }

  // Shows up to 3 cards on desktop, wrapping around so the carousel
  // never runs off the end -- but capped to totalSlides so a single
  // published testimonial doesn't get rendered 3 times over (offset %
  // totalSlides would otherwise always land back on the same item).
  const visibleCount = Math.min(3, totalSlides);
  const desktopItems = totalSlides > 0
    ? Array.from({ length: visibleCount }, (_, offset) => testimonials[(activeIndex + offset) % totalSlides])
    : [];

  // Nothing published yet: hide the whole section rather than show
  // visitors an empty "What our customers say" box.
  if (!loading && totalSlides === 0) return null;

  return (
    <section className="relative overflow-hidden rounded-[1.8rem] border border-amber-200 bg-parchment-50 px-4 py-10 shadow-card sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-amber-200/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-20 h-64 w-64 rounded-full bg-rose-200/20 blur-3xl" />

      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-saffron">
            {t("Blessings from our families")}
          </p>
          <h2 className="mt-2 font-serif text-3xl font-semibold text-maroon sm:text-4xl">
            {t("What our customers say")}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            {t("Genuine experiences from families who invited MyYajmaan into their special occasions.")}
          </p>
        </div>

        {totalSlides > 1 && (
          <div className="hidden items-center gap-2 sm:flex">
            <button type="button" onClick={() => goTo(activeIndex - 1)} aria-label={t("Previous testimonial")} className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-200 bg-white text-lg text-maroon transition hover:bg-maroon hover:text-white">‹</button>
            <button type="button" onClick={() => goTo(activeIndex + 1)} aria-label={t("Next testimonial")} className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-200 bg-white text-lg text-maroon transition hover:bg-maroon hover:text-white">›</button>
          </div>
        )}
      </div>

      {loading && (
        <div className="relative mt-8">
          <Loader variant="card" count={3} />
        </div>
      )}

      {!loading && totalSlides > 0 && (
        <>
          <div className="relative mt-8 sm:hidden">
            <TestimonialCard item={testimonials[activeIndex]} accent={ACCENTS[activeIndex % ACCENTS.length]} onPreviewImage={setPreviewItem} />
          </div>

          <div className="relative mt-8 hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-3">
            {desktopItems.map((item, offset) => (
              <TestimonialCard key={item.id} item={item} accent={ACCENTS[(activeIndex + offset) % ACCENTS.length]} onPreviewImage={setPreviewItem} />
            ))}
          </div>

          {totalSlides > 1 && (
            <div className="relative mt-7 flex items-center justify-center gap-2">
              {testimonials.map((item, index) => (
                <button key={item.id} type="button" onClick={() => goTo(index)} aria-label={t("Show testimonial {v0}", { v0: index + 1 })} className={`h-2.5 rounded-full transition-all duration-300 ${index === activeIndex ? "w-7 bg-saffron" : "w-2.5 bg-amber-200 hover:bg-amber-400"}`} />
              ))}
            </div>
          )}
        </>
      )}

      <Modal
        open={Boolean(previewItem)}
        onClose={() => setPreviewItem(null)}
        title={t("Puja photo from {v0}", { v0: previewItem?.customer_name || "a customer" })}
        size="lg"
      >
        {previewItem?.cover_photo_url && (
          <img loading="lazy" decoding="async"
            src={previewItem.cover_photo_url}
            alt={t("Puja photo shared by {customer_name}", { customer_name: previewItem.customer_name })}
            className="max-h-[70vh] w-full rounded-lg object-contain"
          />
        )}
      </Modal>
    </section>
  );
}
