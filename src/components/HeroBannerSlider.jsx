import { useEffect, useState } from "react";

export default function HeroBannerSlider({ images = [], intervalMs = 4000 }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return undefined;

    const timer = setInterval(() => {
      setActiveIndex((current) => (current + 1) % images.length);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [images.length, intervalMs]);

  const goToPrevious = () => {
    setActiveIndex((current) => (current - 1 + images.length) % images.length);
  };

  const goToNext = () => {
    setActiveIndex((current) => (current + 1) % images.length);
  };

  return (
    <div className="absolute inset-0">
      {images.map((image, index) => (
        <div
          key={image}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === activeIndex ? "opacity-100" : "opacity-0"}`}
        >
          {/* Phones show the whole (wide) banner, not a zoomed-in slice:
              object-contain, with a blurred copy of the same image filling
              the letterbox. From md up the banner sits behind the hero text
              and covers it as before. */}
          <img
            src={image}
            alt=""
            aria-hidden="true"
            decoding="async"
            loading={index === 0 ? undefined : "lazy"}
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-xl md:hidden"
          />
          <img
            src={image}
            alt=""
            aria-hidden="true"
            decoding="async"
            {...(index === 0 ? { fetchpriority: "high" } : { loading: "lazy" })}
            className="absolute inset-0 h-full w-full object-contain object-center md:object-cover"
          />
        </div>
      ))}

      {images.length > 1 && (
        <>
          {/* Bottom-right, over the photo side: centred on the edges they sat
              on top of the headline. Hidden on phones, where the text spans
              the full width -- the banner auto-rotates and has the dots. */}
          <div className="absolute bottom-3 right-3 z-10 hidden gap-2 md:flex">
            <button
              type="button"
              onClick={goToPrevious}
              aria-label="Previous banner image"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-black/25 text-white backdrop-blur-sm transition-colors duration-200 hover:bg-black/40"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={goToNext}
              aria-label="Next banner image"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-black/25 text-white backdrop-blur-sm transition-colors duration-200 hover:bg-black/40"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2">
            {images.map((image, index) => (
              // 24px tap area around each small dot (WCAG 2.2 minimum).
              <button
                key={image}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Go to banner image ${index + 1}`}
                aria-current={index === activeIndex}
                className="group flex h-6 min-w-6 items-center justify-center px-1"
              >
                <span
                  className={`block h-2 rounded-full transition-all ${
                    index === activeIndex ? "w-6 bg-white" : "w-2 bg-white/50 group-hover:bg-white/75"
                  }`}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

