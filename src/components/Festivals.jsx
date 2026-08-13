import React, { useEffect, useState } from "react";
import { withAbortGet } from "../api";
import Loader from "./common/Loader";

/* FestivalCard unchanged (keeps image/title/date rendering) */
function formatFestivalDate(f) {
  if (f?.start_date) {
    const d = new Date(f.start_date);
    if (!isNaN(d)) {
      return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
    }
  }
  return f?.date || "";
}

function FestivalCard({ festival }) {
  return (
    <div className="overflow-hidden rounded-[1rem] border border-amber-100 bg-white shadow-sm">
      <div className="relative h-24">
        <img src={festival.image_url} alt={festival.title || festival.name} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
      </div>
      <div className="px-3 py-2 text-center">
        <p className="text-sm font-semibold text-slate-800">{festival.title || festival.name}</p>
        <p className="text-sm text-slate-600">{festival.description}</p>
        <p className="text-xs font-semibold text-slate-800">{formatFestivalDate(festival)}</p>
      </div>
    </div>
  );
}

export default function Festivals({ limit = 4 }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const { promise, controller } = withAbortGet("/festivals", { params: { highlight: true, limit } });

    setLoading(true);
    setError(null);

    promise
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch((err) => {
        if (err?.isCanceled || err?.name === "CanceledError") return;
        console.error("Festivals load error:", err);
        setError(err?.message || "Failed to load festivals");
      })
      .finally(() => setLoading(false));

    return () => {
      try {
        controller.abort();
      } catch (_) {}
    };
  }, [limit]);

  if (loading) return <div className="p-4"><Loader variant="card" count={limit} /></div>;
  if (error) return <div className="p-4 text-center text-sm text-red-500">Error loading festivals: {error}</div>;
  if (!items || items.length === 0) return <div className="p-4 text-center text-sm text-slate-500">No highlighted festivals right now.</div>;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((festival) => (
        <FestivalCard key={festival.id || festival.title} festival={festival} />
      ))}
    </div>
  );
}