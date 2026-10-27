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
        <img
          key={image}
          src={image}
          alt=""
          aria-hidden="true"
          decoding="async"
          {...(index === 0 ? { fetchpriority: "high" } : { loading: "lazy" })}
          className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-1000 ease-in-out ${
            index === activeIndex ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={goToPrevious}
            aria-label="Previous banner image"
            className="absolute left-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/25 text-white backdrop-blur-sm transition-colors duration-200 hover:bg-black/40 sm:left-3 sm:h-8 sm:w-8"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={goToNext}
            aria-label="Next banner image"
            className="absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/25 text-white backdrop-blur-sm transition-colors duration-200 hover:bg-black/40 sm:right-3 sm:h-8 sm:w-8"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
            {images.map((image, index) => (
              <button
                key={image}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Go to banner image ${index + 1}`}
                aria-current={index === activeIndex}
                className={`h-2 rounded-full transition-all ${
                  index === activeIndex ? "w-6 bg-white" : "w-2 bg-white/50 hover:bg-white/75"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

