import Modal from "./Modal";
import { getLanguage, t } from "../i18n";

export function formatFestivalDate(date) {
  if (!date) return "";
  const value = new Date(`${date}T00:00:00`);
  return value.toLocaleDateString(getLanguage() === "hi" ? "hi-IN" : "en-IN", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// "Selected date is different from the recommended festival date" popup
// for festival-specific pujas (see utils/festivalDates.js).
//   Change Date     -> caller moves the date to warning.recommendedDate
//   Continue Anyway -> caller goes ahead with the customer's own date
export default function FestivalDateWarning({ warning, onChangeDate, onContinue, onClose }) {
  const range = warning?.endDate
    ? t("{start} to {end}", { start: formatFestivalDate(warning.startDate), end: formatFestivalDate(warning.endDate) })
    : formatFestivalDate(warning?.recommendedDate);

  return (
    <Modal open={Boolean(warning)} onClose={onClose} title={t("Festival date check")} size="sm">
      {warning && (
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            {t("Selected date is different from the recommended festival date. Would you like to continue?")}
          </p>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
            <p className="text-xs font-semibold uppercase text-amber-700">{t("Recommended date for {festival}", { festival: warning.festivalName })}</p>
            <p className="mt-1 font-semibold text-maroon">🪔 {range}</p>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onContinue}
              className="interactive-button min-h-[44px] rounded-full border border-amber-200 px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-amber-50"
            >
              {t("Continue Anyway")}
            </button>
            <button
              type="button"
              onClick={onChangeDate}
              className="interactive-button min-h-[44px] rounded-full bg-maroon px-5 py-2 text-sm font-semibold text-white"
            >
              {t("Change Date")}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
