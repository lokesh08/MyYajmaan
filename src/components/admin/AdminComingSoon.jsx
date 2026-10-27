export default function AdminComingSoon({ title }) {
  return (
    <div className="rounded-2xl border border-amber-100 bg-white p-10 text-center shadow-sm">
      <p className="font-serif text-xl font-semibold text-maroon">{title}</p>
      <p className="mt-2 text-sm text-slate-500">This module is coming soon.</p>
    </div>
  );
}
