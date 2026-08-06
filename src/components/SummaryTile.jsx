export default function SummaryTile({ label, value, className = '' }) {
  return (
    <div className={`rounded-2xl border border-white/80 bg-white/80 p-3 shadow-sm transition hover:-translate-y-0.5 ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-800">{value}</p>
    </div>
  );
}
