import { useRef, useState } from "react";
import { alpha, colors } from "../../theme/tokens";

function formatDateLabel(dateStr) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function BookingsOverviewChart({ series = [] }) {
  const width = 560;
  const height = 200;
  const padding = 24;

  const containerRef = useRef(null);
  const [hoverIndex, setHoverIndex] = useState(null);

  const maxCount = Math.max(1, ...series.map((point) => point.count));
  const stepX = series.length > 1 ? (width - padding * 2) / (series.length - 1) : 0;

  const points = series.map((point, index) => {
    const x = padding + index * stepX;
    const y = height - padding - (point.count / maxCount) * (height - padding * 2);
    return { x, y, ...point };
  });

  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  const areaPath = points.length
    ? `${linePath} L${points[points.length - 1].x},${height - padding} L${points[0].x},${height - padding} Z`
    : "";

  function handlePointerMove(event) {
    if (points.length === 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    // The crosshair snaps to the nearest data position -- readers aim
    // at a date, never at a 2px line (dataviz skill: interaction.md).
    const relativeX = ((event.clientX - bounds.left) / bounds.width) * width;
    let nearest = 0;
    let nearestDistance = Infinity;
    points.forEach((point, index) => {
      const distance = Math.abs(point.x - relativeX);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = index;
      }
    });
    setHoverIndex(nearest);
  }

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;
  const tooltipLeftPercent = hovered ? (hovered.x / width) * 100 : 0;
  const tooltipAlign = tooltipLeftPercent > 75 ? "right" : tooltipLeftPercent < 25 ? "left" : "center";

  return (
    <div ref={containerRef} className="relative rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-maroon">Bookings Overview</p>
        <span className="text-xs text-slate-400">Last {series.length} Days</span>
      </div>

      {points.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">No booking data yet.</p>
      ) : (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-48 w-full cursor-crosshair"
          preserveAspectRatio="none"
          onMouseMove={handlePointerMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <path d={areaPath} fill={alpha(colors.saffron, 0.12)} />
          <path d={linePath} fill="none" stroke={colors.saffron} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {hovered && (
            <line x1={hovered.x} y1={padding} x2={hovered.x} y2={height - padding} stroke={colors.slate[300]} strokeWidth="1" />
          )}

          {points.map((point, index) => {
            const isHovered = index === hoverIndex;
            return (
              <circle
                key={point.date}
                cx={point.x}
                cy={point.y}
                r={isHovered ? 5.5 : 3.5}
                fill={colors.maroon.DEFAULT}
                stroke={colors.white}
                strokeWidth={isHovered ? 2.5 : 2}
                className="transition-[r] duration-100"
              />
            );
          })}
        </svg>
      )}

      <div className="mt-2 flex justify-between text-[11px] text-slate-400">
        {points.length > 0 && (
          <>
            <span>{points[0].date}</span>
            <span>{points[points.length - 1].date}</span>
          </>
        )}
      </div>

      {hovered && (
        <div
          className={`pointer-events-none absolute top-4 rounded-xl border border-amber-100 bg-white px-3 py-2 text-xs shadow-lg ${
            tooltipAlign === "right" ? "right-4" : tooltipAlign === "left" ? "left-4" : "left-1/2 -translate-x-1/2"
          }`}
        >
          <p className="font-semibold text-slate-700">{formatDateLabel(hovered.date)}</p>
          <p className="mt-0.5 text-slate-500">
            <span className="font-bold text-slate-800">{hovered.count}</span> booking{hovered.count === 1 ? "" : "s"}
          </p>
        </div>
      )}
    </div>
  );
}
