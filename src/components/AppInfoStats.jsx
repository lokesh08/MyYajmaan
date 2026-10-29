const STATS = [
  { icon: "🏺", value: "5000+", label: "Pujas Performed" },
  { icon: "🙏", value: "250+", label: "Vedic Priests" },
  { icon: "🔥", value: "1000+", label: "Types of Pujas & Homams" },
];

/**
 * Trust/credibility strip shown on the puja and pandit detail pages.
 * Static marketing figures (not DB-driven), restyled to this app's
 * cream/maroon/gold palette.
 */
export default function AppInfoStats() {
  return (
    <div className="relative mt-8 overflow-hidden rounded-[1.8rem] border border-amber-200 bg-gradient-to-br from-parchment-100 via-parchment-50 to-parchment-300 px-6 py-8 shadow-card">
      <div className="pointer-events-none absolute -left-12 -top-16 h-40 w-40 rounded-full bg-saffron/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 right-10 h-40 w-40 rounded-full bg-maroon/10 blur-3xl" />

      <div className="relative grid gap-6 sm:grid-cols-3">
        {STATS.map((stat) => (
          <div key={stat.label} className="flex items-center gap-4 sm:flex-col sm:text-center">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-2xl shadow-sm ring-1 ring-amber-200">
              {stat.icon}
            </div>
            <div>
              <p className="font-serif text-2xl font-bold text-maroon">{stat.value}</p>
              <p className="text-sm font-medium text-slate-600">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
