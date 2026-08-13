import React, { useEffect, useState } from "react";
import { withAbortGet } from "../api";
import { Loader } from "./common";

/**
 * Pujas component
 * - GET /pujas?limit=...
 * - uses thumbnail_url for list images (thumbnail), image_url for detail (if needed)
 *
 * Props:
 *  - limit: number of items to fetch (default 4)
 *  - onView: function(puja) called when "View" clicked
 *  - onBook: function(puja) called when "Book" clicked
 */
function PujaCard({ puja, onView = () => {}, onBook = () => {} }) {
  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-amber-100 bg-white shadow-[0_14px_35px_rgba(122,31,45,0.05)]">
      <div className="relative h-44 overflow-hidden">
        <img src={puja.thumbnail_url || puja.image_url} alt={puja.title} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 text-white">
          <p className="font-serif text-lg font-semibold">{puja.title}</p>
          {puja.duration_minutes ? (
            <p className="text-sm text-amber-100">{`${puja.duration_minutes} mins`}</p>
          ) : null}
        </div>
      </div>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="text-sm text-slate-600">From</div>
        <div className="font-semibold text-maroon">{puja.price ? `₹${puja.price}` : "-"}</div>
      </div>
      <div className="px-4 pb-4 flex gap-2">
        <button onClick={() => onView(puja)} className="flex-1 rounded-full border border-amber-200 bg-white px-4 py-2 text-center text-sm font-semibold text-slate-700">
          View
        </button>
        <button onClick={() => onBook(puja)} className="flex-1 rounded-full bg-maroon px-4 py-2 text-center text-sm font-semibold text-white">
          Book
        </button>
      </div>
    </div>
  );
}

export default function Pujas({ limit = 4, onView, onBook }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const { promise, controller } = withAbortGet("/pujas", { params: { limit } });

    setLoading(true);
    setError(null);

    promise
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch((err) => {
        if (err?.isCanceled || err?.name === "CanceledError") return;
        console.error("Pujas load error:", err);
        setError(err?.message || "Failed to load pujas");
      })
      .finally(() => setLoading(false));

    return () => {
      try {
        controller.abort();
      } catch (_) {}
    };
  }, [limit]);

  if (loading) return <div className="p-4"><Loader variant="card" count={limit} /></div>;
  if (error) return <div className="p-4 text-center text-sm text-red-500">Error loading pujas: {error}</div>;
  if (!items || items.length === 0) return <div className="p-4 text-center text-sm text-slate-500">No pujas available.</div>;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((puja) => (
        <PujaCard key={puja.id || puja.title} puja={puja} onView={onView} onBook={onBook} />
      ))}
    </div>
  );
}