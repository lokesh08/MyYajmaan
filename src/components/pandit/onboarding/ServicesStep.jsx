import { useEffect, useState } from "react";

import { addMyPujas, listMyPujas, listPublicPujas, savePanditAvailability } from "../../../services/panditApi";
import { showError } from "../../../utils/toaster";
import { t } from "../../../i18n";

const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

const TIMESLOTS = [
  { key: "morning", label: "Morning (6:00 AM - 12:00 PM)", start: "06:00", end: "12:00" },
  { key: "afternoon", label: "Afternoon (12:00 PM - 5:00 PM)", start: "12:00", end: "17:00" },
  { key: "evening", label: "Evening (5:00 PM - 9:00 PM)", start: "17:00", end: "21:00" },
  { key: "full_day", label: "Full Day (6:00 AM - 9:00 PM)", start: "06:00", end: "21:00" },
];

export default function ServicesStep({ onNext, onBack }) {
  const [catalog, setCatalog] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [selected, setSelected] = useState({}); // puja_id -> fee string
  const [days, setDays] = useState([]);
  const [timeslotKey, setTimeslotKey] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([listPublicPujas(200), listMyPujas()])
      .then(([pujas, mine]) => {
        setCatalog(pujas || []);
        const already = {};
        (mine?.items || []).forEach((row) => {
          already[row.puja_id] = String(row.price_override ?? "");
        });
        setSelected(already);
      })
      .catch(() => showError(t("Could not load the puja list.")))
      .finally(() => setLoadingCatalog(false));
  }, []);

  function toggleDay(key) {
    setDays((current) => (current.includes(key) ? current.filter((d) => d !== key) : [...current, key]));
  }

  function toggleAllDays() {
    setDays((current) => (current.length === DAYS.length ? [] : DAYS.map((d) => d.key)));
  }

  function togglePuja(pujaId) {
    setSelected((current) => {
      const next = { ...current };
      if (pujaId in next) {
        delete next[pujaId];
      } else {
        next[pujaId] = "";
      }
      return next;
    });
  }

  function updateFee(pujaId, value) {
    setSelected((current) => ({ ...current, [pujaId]: value }));
  }

  function validate() {
    const pujaIds = Object.keys(selected);
    if (pujaIds.length === 0) return "Please select at least one puja you perform.";
    for (const pujaId of pujaIds) {
      const fee = Number(selected[pujaId]);
      if (!selected[pujaId] || !(fee > 0)) {
        return "Please enter a fee for every puja you've selected.";
      }
    }
    if (days.length === 0) return "Please select your available days.";
    if (!timeslotKey) return "Please select your timeslot.";
    return null;
  }

  async function handleNext() {
    const validationError = validate();
    if (validationError) {
      showError(validationError);
      return;
    }

    const timeslot = TIMESLOTS.find((slot) => slot.key === timeslotKey);
    setSaving(true);
    try {
      const existingResp = await listMyPujas();
      const alreadyAdded = new Set((existingResp?.items || []).map((row) => row.puja_id));
      const newSelections = Object.entries(selected)
        .filter(([pujaId]) => !alreadyAdded.has(pujaId))
        .map(([pujaId, fee]) => ({ puja_id: pujaId, price_override: Number(fee) }));

      if (newSelections.length > 0) {
        await addMyPujas(newSelections);
      }

      await savePanditAvailability({ days, start_time: timeslot.start, end_time: timeslot.end });
      onNext();
    } catch (error) {
      showError(error?.message || t("Could not save your services & availability."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-700">{t("Select the pujas you perform *")}</p>
        {loadingCatalog ? (
          <p className="py-6 text-center text-sm text-slate-400">{t("Loading pujas...")}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {catalog.map((puja) => {
              const isChecked = puja.id in selected;
              return (
                <div
                  key={puja.id}
                  className={`rounded-xl border p-3 transition ${
                    isChecked ? "border-maroon bg-amber-50/60" : "border-amber-200 bg-white"
                  }`}
                >
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => togglePuja(puja.id)}
                      className="mt-0.5 h-4 w-4 rounded border-amber-300 text-maroon focus:ring-amber-200"
                    />
                    <span className="text-sm font-medium text-slate-700">{t(puja.title)}</span>
                  </label>

                  {isChecked && (
                    <div className="mt-2 pl-6">
                      <input
                        type="number"
                        min="1"
                        value={selected[puja.id]}
                        onChange={(event) => updateFee(puja.id, event.target.value)}
                        placeholder={t("Your fee (Rs.) *")}
                        className="w-full rounded-lg border border-amber-200 px-2.5 py-1.5 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-700">{t("Available Days *")}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={toggleAllDays}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              days.length === DAYS.length ? "border-maroon bg-maroon text-white" : "border-amber-200 text-slate-600 hover:bg-amber-50"
            }`}
          >
            {t("All Days")}
          </button>
          {DAYS.map((day) => (
            <button
              key={day.key}
              type="button"
              onClick={() => toggleDay(day.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                days.includes(day.key) ? "border-maroon bg-maroon text-white" : "border-amber-200 text-slate-600 hover:bg-amber-50"
              }`}
            >
              {t(day.label)}
            </button>
          ))}
        </div>
      </div>

      <label className="block max-w-sm">
        <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">{t("Timeslot *")}</span>
        <select
          value={timeslotKey}
          onChange={(event) => setTimeslotKey(event.target.value)}
          className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
        >
          <option value="">{t("Select a timeslot")}</option>
          {TIMESLOTS.map((slot) => (
            <option key={slot.key} value={slot.key}>
              {t(slot.label)}
            </option>
          ))}
        </select>
      </label>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="interactive-button rounded-full border border-amber-200 px-6 py-2.5 text-sm font-semibold text-slate-600 hover:bg-amber-50"
        >
          {t("Back")}
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={saving}
          className="interactive-button rounded-full bg-maroon px-6 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? t("Saving...") : t("Save & Next")}
        </button>
      </div>
    </div>
  );
}
