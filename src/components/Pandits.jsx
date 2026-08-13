import React, { useEffect, useState } from "react";
import { withAbortGet } from "../api";
import { Loader } from "./common";

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
    <div className="rounded-[1.25rem] border border-amber-100 bg-white p-4 shadow-[0_12px_30px_rgba(122,31,45,0.05)]">
      <div className="flex items-center gap-4">
        <img src={p.image || p.avatar_url} alt={p.name} className="h-24 w-24 rounded-full object-cover" />
        <div className="flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900">{p.name}</p>
              <p className="text-sm text-slate-500">Vedic rituals • {p.languages?.join(", ") || "Hindi, English"}</p>
            </div>
            <div className="text-right">
              <div className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-maroon">{p.price ? `₹${p.price}` : "-"}</div>
              <p className="mt-1 text-sm text-amber-500">⭐ {p.rating ?? "-"}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={() => onView(p)} className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700">View</button>
            <button onClick={() => onSelect(p)} className="ml-auto rounded-full bg-saffron px-3 py-1.5 text-sm font-semibold text-white">Select</button>
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