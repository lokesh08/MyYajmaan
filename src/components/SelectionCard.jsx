export default function SelectionCard({
  children,
  selected = false,
  onClick,
  ariaLabel,
  ariaPressed = selected,
  className = '',
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      onClick={onClick}
      className={`group w-full rounded-[1.2rem] border text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99] ${selected ? 'border-maroon bg-gradient-to-br from-[#fff6f1] to-[#fffaf3] ring-2 ring-maroon/20' : 'border-amber-200 bg-white hover:border-maroon/60'} ${className}`}
    >
      {children}
    </button>
  );
}
