import { useRef, useState } from "react";
import { colors } from "../../theme/tokens";

// Fixed per-status assignment (never by array index/position) so a
// status's color stays the same regardless of what order the backend
// happens to return them in -- see routers/admin_dashboard.py's
// get_bookings_by_status(), which tallies via Counter() (insertion-
// order, not a fixed order). Validated for CVD-safe separation and
// >=3:1 contrast against a white surface (dataviz skill's
// validate_palette.js); the worst adjacent pair (emerald<->amber) sits
// in the 6-8 "legal with secondary encoding" band, covered here by the
// legend's always-visible status name + percent labels.
const STATUS_META = {
  pending_pandit: { label: "Awaiting Pandit", color: colors.saffron },
  confirmed: { label: "Confirmed", color: colors.sky[600] },
  completed: { label: "Completed", color: colors.emerald[600] },
  declined: { label: "Declined", color: colors.rose[700] },
  cancelled: { label: "Cancelled", color: colors.violet[600] },
};
const FALLBACK_COLOR = colors.slate[500];

function buildDonutSlices(statuses) {
  const total = statuses.reduce((sum, item) => sum + item.count, 0) || 1;
  let cumulative = 0;

  return statuses.map((item) => {
    const meta = STATUS_META[item.status];
    const fraction = item.count / total;
    const startAngle = cumulative * 360;
    cumulative += fraction;
    const endAngle = cumulative * 360;
    return {
      ...item,
      startAngle,
      endAngle,
      color: meta?.color || FALLBACK_COLOR,
      label: meta?.label || item.status,
      percent: Math.round(fraction * 100),
    };
  });
}

function polarToCartesian(cx, cy, radius, angleDegrees) {
  const angleRad = ((angleDegrees - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(angleRad), y: cy + radius * Math.sin(angleRad) };
}

function describeArc(cx, cy, radius, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
}

export default function BookingsStatusPie({ statuses = [] }) {
  const slices = buildDonutSlices(statuses);
  const size = 160;
  const center = size / 2;
  const radius = size / 2;
  const total = statuses.reduce((sum, item) => sum + item.count, 0);

  const containerRef = useRef(null);
  const [active, setActive] = useState(null); // { slice, x, y }

  function showTooltip(event, slice) {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setActive({ slice, x: event.clientX - bounds.left, y: event.clientY - bounds.top });
  }

  function showTooltipForLegend(event, slice) {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const target = event.currentTarget.getBoundingClientRect();
    setActive({ slice, x: target.left - bounds.left + target.width / 2, y: target.top - bounds.top });
  }

  return (
    <div ref={containerRef} className="relative rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
      <p className="mb-3 text-sm font-semibold text-maroon">Bookings by Status</p>

      {slices.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">No booking data yet.</p>
      ) : (
        <div className="flex items-center gap-4">
          <svg viewBox={`0 0 ${size} ${size}`} className="h-32 w-32 shrink-0 overflow-visible">
            {slices.map((slice) => {
              const isActive = active?.slice.status === slice.status;
              return (
                <path
                  key={slice.status}
                  d={describeArc(center, center, radius, slice.startAngle, slice.endAngle)}
                  fill={slice.color}
                  opacity={active && !isActive ? 0.45 : 1}
                  className="cursor-pointer transition-[opacity,transform] duration-150 ease-out"
                  style={{
                    transform: isActive ? `scale(1.04)` : "scale(1)",
                    transformOrigin: `${center}px ${center}px`,
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`${slice.label}: ${slice.count} bookings, ${slice.percent}%`}
                  onMouseMove={(event) => showTooltip(event, slice)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={(event) => showTooltipForLegend(event, slice)}
                  onBlur={() => setActive(null)}
                />
              );
            })}
            <circle cx={center} cy={center} r={radius * 0.55} fill={colors.white} />
            <text x={center} y={center - 4} textAnchor="middle" className="fill-slate-800 text-[15px] font-bold" style={{ fontFamily: "inherit" }}>
              {total}
            </text>
            <text x={center} y={center + 12} textAnchor="middle" className="fill-slate-400 text-[8px] font-medium uppercase" style={{ fontFamily: "inherit" }}>
              Total
            </text>
          </svg>

          <ul className="space-y-1.5 text-xs">
            {slices.map((slice) => (
              <li key={slice.status}>
                <button
                  type="button"
                  onMouseMove={(event) => showTooltipForLegend(event, slice)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={(event) => showTooltipForLegend(event, slice)}
                  onBlur={() => setActive(null)}
                  className={`interactive-button flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left transition ${
                    active?.slice.status === slice.status ? "bg-amber-50" : "hover:bg-amber-50/60"
                  }`}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
                  <span className="text-slate-600">{slice.label}</span>
                  <span className="font-semibold text-slate-800">{slice.percent}%</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {active && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-xl border border-amber-100 bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: active.x, top: active.y }}
        >
          <p className="flex items-center gap-1.5 font-semibold text-slate-700">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: active.slice.color }} />
            {active.slice.label}
          </p>
          <p className="mt-0.5 text-slate-500">
            <span className="font-bold text-slate-800">{active.slice.count}</span> booking{active.slice.count === 1 ? "" : "s"} · {active.slice.percent}%
          </p>
        </div>
      )}
    </div>
  );
}
