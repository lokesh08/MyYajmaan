export default function TopCitiesList({ cities = [] }) {
  return (
    <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
      <p className="mb-3 text-sm font-semibold text-maroon">Top Cities</p>

      {cities.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">No booking location data yet.</p>
      ) : (
        <div className="space-y-3">
          {cities.map((city) => (
            <div key={city.city} className="flex items-center gap-3 text-sm">
              <span className="w-28 shrink-0 truncate text-slate-600">{city.city}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-amber-50">
                <div className="h-full rounded-full bg-saffron" style={{ width: `${city.percent}%` }} />
              </div>
              <span className="w-10 shrink-0 text-right font-semibold text-slate-700">{city.percent}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
