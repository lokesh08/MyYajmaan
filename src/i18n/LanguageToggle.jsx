import { useLanguage } from "./LanguageProvider";

// EN | हिं switch. `tone="dark"` for maroon headers, "light" for white panels.
export default function LanguageToggle({ tone = "dark", className = "" }) {
  const { chosenLanguage, setLanguage, canSwitch } = useLanguage();
  if (!canSwitch) return null;

  const base =
    tone === "dark"
      ? "border-white/30 bg-white/10 text-amber-50"
      : "border-amber-200 bg-white text-slate-600";
  const active = tone === "dark" ? "bg-amber-50 text-maroon" : "bg-maroon text-white";

  return (
    <div role="group" aria-label="Language / भाषा" className={`inline-flex shrink-0 items-center rounded-full border p-0.5 text-xs font-semibold ${base} ${className}`}>
      {[
        { code: "en", label: "EN", title: "English" },
        { code: "hi", label: "हिं", title: "हिंदी" },
      ].map((option) => (
        <button
          key={option.code}
          type="button"
          lang={option.code}
          title={option.title}
          aria-pressed={chosenLanguage === option.code}
          onClick={() => setLanguage(option.code)}
          className={`min-h-[32px] min-w-[36px] rounded-full px-2.5 transition ${chosenLanguage === option.code ? active : "hover:opacity-80"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
