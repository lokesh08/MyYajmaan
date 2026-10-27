export default function TopPujaList({ pujas = [] }) {
  return (
    <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
      <p className="mb-3 text-sm font-semibold text-maroon">Top Puja (This Month)</p>

      {pujas.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">No booking data yet.</p>
      ) : (
        <ul className="space-y-2">
          {pujas.map((puja) => (
            <li key={puja.puja_id} className="flex items-center justify-between rounded-xl bg-amber-50/60 px-3 py-2 text-sm">
              <span className="font-medium text-slate-700">{puja.title}</span>
              <span className="text-xs font-semibold text-maroon">{puja.booking_count} bookings</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
