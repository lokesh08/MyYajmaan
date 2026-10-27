import { Link } from "react-router-dom";

const ACCENT_CLASSES = {
  maroon: "text-maroon",
  saffron: "text-saffron",
  emerald: "text-emerald-600",
};

export default function StatCard({ label, value, delta, deltaPositive = true, accent = "maroon", to }) {
  const content = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className={`text-2xl font-bold ${ACCENT_CLASSES[accent] || ACCENT_CLASSES.maroon}`}>{value}</p>
        {delta && (
          <span className={`text-xs font-semibold ${deltaPositive ? "text-emerald-600" : "text-rose-600"}`}>
            {delta}
          </span>
        )}
      </div>
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        title={`View ${label.toLowerCase()}`}
        className="interactive-button block rounded-2xl border border-amber-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-saffron/40 hover:shadow-md"
      >
        {content}
      </Link>
    );
  }

  return <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">{content}</div>;
}
