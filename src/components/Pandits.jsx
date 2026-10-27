import React, { useEffect, useState } from "react";
import { withAbortGet } from "../api";
import { Loader } from "./common";
import { panditPlaceholderImage } from "../constants/visualAssets";
import { optimizedImage } from "../utils/image";

/**
 * Pandits component
 * - GET /pandits?limit=...
 *
 * Props:
 *  - limit: number of items to fetch (default 4)
 *  - onView: (pandit) => void
 *  - onSelect: (pandit) => void
 */
function PanditCard({ p, onView = () => {}, onSelect = () => {} }) {
  return (
    <div className="h-full rounded-[1.25rem] border border-amber-200 bg-white p-4 shadow-card-sm">
      <div className="flex items-center gap-4">
        <img loading="lazy" decoding="async"
          src={optimizedImage(p.image || p.avatar_url || panditPlaceholderImage)}
          alt={p.name}
          className="h-24 w-24 rounded-full object-cover"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = panditPlaceholderImage;
          }}
        />
        <div className="flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900">{p.name}</p>
              <p className="text-sm text-slate-500">Vedic rituals • {p.languages?.join(", ") || "Hindi, English"}</p>
            </div>
            <div className="text-right">
              {p.starting_price ? (
                <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-maroon">Starts from ₹{p.starting_price}</div>
              ) : null}
              <p className="mt-1 text-sm text-amber-500">⭐ {p.rating ?? "-"}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={() => onView(p)} className="interactive-button rounded-full border border-amber-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:border-maroon hover:text-maroon">View</button>
            <button onClick={() => onSelect(p)} className="interactive-button ml-auto rounded-full bg-saffron px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-500">Select</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Pandits({ limit = 4, onView, onSelect }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const { promise, controller } = withAbortGet("/pandits", { params: { limit } });

    setLoading(true);
    setError(null);

    promise
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch((err) => {
        if (err?.isCanceled || err?.name === "CanceledError") return;
        console.error("Pandits load error:", err);
        setError(err?.message || "Failed to load pandits");
      })
      .finally(() => setLoading(false));

    return () => {
      try {
        controller.abort();
      } catch (_) {}
    };
  }, [limit]);

  if (loading) return <div className="p-4"><Loader variant="card" count={limit} /></div>;
  if (error) return <div className="p-4 text-center text-sm text-red-500">Error loading pandits: {error}</div>;
  if (!items || items.length === 0) return <div className="p-4 text-center text-sm text-slate-500">No pandits available.</div>;

  return (
    <div className="grid gap-4">
      {items.map((p) => (
        <PanditCard key={p.id || p.name} p={p} onView={onView} onSelect={onSelect} />
      ))}
    </div>
  );
}