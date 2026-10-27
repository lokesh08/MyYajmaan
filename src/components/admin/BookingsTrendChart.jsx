import { useState } from "react";
import { colors } from "../../theme/tokens";

// Emerald-600 (not the lighter -500) -- validated for >=3:1 contrast
// against the white chart surface at 2px stroke width (dataviz skill's
// validate_palette.js); paired with amber-600 the CVD separation
// passes cleanly (deutan/tritan/normal-vision all comfortably above
// the safe floor).
const THIS_MONTH_COLOR = colors.saffron;
const LAST_MONTH_COLOR = colors.emerald[600];

export default function BookingsTrendChart({ series = [] }) {
  const width = 640;
  const height = 220;
  const padding = 28;

  const [hoverIndex, setHoverIndex] = useState(null);

  const maxCount = Math.max(1, ...series.map((point) => Math.max(point.this_month, point.last_month)));
  const stepX = series.length > 1 ? (width - padding * 2) / (series.length - 1) : 0;

  function toPoints(key) {
    return series.map((point, index) => {
      const x = padding + index * stepX;
      const y = height - padding - (point[key] / maxCount) * (height - padding * 2);
      return { x, y, day: point.day, value: point[key] };
    });
  }

  function toPath(points) {
    return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  }

  const thisMonthPoints = toPoints("this_month");
  const lastMonthPoints = toPoints("last_month");

  function handlePointerMove(event) {
    if (series.length === 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const relativeX = ((event.clientX - bounds.left) / bounds.width) * width;
    let nearest = 0;
    let nearestDistance = Infinity;
    thisMonthPoints.forEach((point, index) => {
      const distance = Math.abs(point.x - relativeX);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = index;
      }
    });
    setHoverIndex(nearest);
  }

  const hoveredThis = hoverIndex !== null ? thisMonthPoints[hoverIndex] : null;
  const hoveredLast = hoverIndex !== null ? lastMonthPoints[hoverIndex] : null;
  const tooltipLeftPercent = hoveredThis ? (hoveredThis.x / width) * 100 : 0;
  const tooltipAlign = tooltipLeftPercent > 75 ? "right" : tooltipLeftPercent < 25 ? "left" : "center";

  return (
    <div className="relative rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-maroon">Bookings Trend</p>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: THIS_MONTH_COLOR }} /> This Month
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: LAST_MONTH_COLOR }} /> Last Month
          </span>
        </div>
      </div>

      {series.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">No booking data yet.</p>
      ) : (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-56 w-full cursor-crosshair"
          preserveAspectRatio="none"
          onMouseMove={handlePointerMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <path d={toPath(lastMonthPoints)} fill="none" stroke={LAST_MONTH_COLOR} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d={toPath(thisMonthPoints)} fill="none" stroke={THIS_MONTH_COLOR} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {hoveredThis && (
            <line x1={hoveredThis.x} y1={padding} x2={hoveredThis.x} y2={height - padding} stroke={colors.slate[300]} strokeWidth="1" />
          )}

          {lastMonthPoints.map((point, index) => (
            <circle
              key={`last-${point.day}`}
              cx={point.x}
              cy={point.y}
              r={index === hoverIndex ? 5 : 0}
              fill={LAST_MONTH_COLOR}
              stroke={colors.white}
              strokeWidth="2"
              className="transition-[r] duration-100"
            />
          ))}
          {thisMonthPoints.map((point, index) => (
            <circle
              key={`this-${point.day}`}
              cx={point.x}
              cy={point.y}
              r={index === hoverIndex ? 5.5 : 3}
              fill={colors.maroon.DEFAULT}
              stroke={colors.white}
              strokeWidth={index === hoverIndex ? 2.5 : 2}
              className="transition-[r] duration-100"
            />
          ))}
        </svg>
      )}

      <div className="mt-2 flex justify-between text-[11px] text-slate-400">
        {series.length > 0 && (
          <>
            <span>Day {series[0].day}</span>
            <span>Day {series[series.length - 1].day}</span>
          </>
        )}
      </div>

      {hoveredThis && hoveredLast && (
        <div
          className={`pointer-events-none absolute top-4 rounded-xl border border-amber-100 bg-white px-3 py-2 text-xs shadow-lg ${
            tooltipAlign === "right" ? "right-4" : tooltipAlign === "left" ? "left-4" : "left-1/2 -translate-x-1/2"
          }`}
        >
          <p className="font-semibold text-slate-700">Day {hoveredThis.day}</p>
          <p className="mt-1 flex items-center gap-1.5 text-slate-500">
            <span className="h-1.5 w-4 shrink-0 rounded-full" style={{ backgroundColor: THIS_MONTH_COLOR }} />
            This Month: <span className="font-bold text-slate-800">{hoveredThis.value}</span>
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-slate-500">
            <span className="h-1.5 w-4 shrink-0 rounded-full" style={{ backgroundColor: LAST_MONTH_COLOR }} />
            Last Month: <span className="font-bold text-slate-800">{hoveredLast.value}</span>
          </p>
        </div>
      )}
    </div>
  );
}
