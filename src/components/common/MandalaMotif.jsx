// A simple line-art mandala: concentric rings + radiating lotus
// petals. Rendered with `stroke="currentColor"` so it inherits
// whatever low-opacity text color it's given — used as a faint
// sacred-geometry watermark on dark, divine-themed surfaces
// (footer, hero panels).
export default function MandalaMotif({ className }) {
  const petals = Array.from({ length: 12 });

  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <circle cx="100" cy="100" r="92" strokeWidth="0.5" />
      <circle cx="100" cy="100" r="74" strokeWidth="0.5" />
      <circle cx="100" cy="100" r="56" strokeWidth="0.5" strokeDasharray="2 4" />

      {petals.map((_, index) => (
        <path
          key={index}
          d="M100 8 C 109 26, 109 42, 100 50 C 91 42, 91 26, 100 8 Z"
          strokeWidth="0.6"
          transform={`rotate(${(index * 360) / petals.length} 100 100)`}
        />
      ))}

      <circle cx="100" cy="100" r="10" strokeWidth="0.6" />
      <circle cx="100" cy="100" r="3" fill="currentColor" stroke="none" />
    </svg>
  );
}
