import { useEffect, useState } from "react";
import { get } from "../api";

export default function OffersBanner() {
  const [offers, setOffers] = useState([]);

  useEffect(() => {
    let active = true;

    get("/offers")
      .then((data) => {
        if (active) setOffers(Array.isArray(data) ? data.slice(0, 3) : []);
      })
      .catch(() => {
        if (active) setOffers([]);
      });

    return () => {
      active = false;
    };
  }, []);

  if (!offers.length) return null;

  return (
    <section className="mt-8" aria-label="Current offers">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-[1.75rem] font-semibold text-maroon">
          Offers for your next puja
        </h2>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {offers.map((offer) => (
          <article
            key={offer.id}
            className="overflow-hidden rounded-[1rem] border border-amber-200 bg-white shadow-card-sm"
          >
            {offer.image_url && (
              <img
                src={offer.image_url}
                alt=""
                className="h-32 w-full object-cover"
              />
            )}
            <div className="p-4">
              <h3 className="font-serif text-lg font-semibold text-maroon">
                {offer.title}
              </h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {offer.description}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
