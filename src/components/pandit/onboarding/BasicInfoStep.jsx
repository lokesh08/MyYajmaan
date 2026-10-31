import { useEffect, useRef, useState } from "react";

import { savePanditProfile } from "../../../services/panditApi";
import { showError } from "../../../utils/toaster";
import { t } from "../../../i18n";

const inputClass =
  "w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100";
const disabledInputClass =
  "w-full cursor-not-allowed rounded-xl border border-amber-100 bg-slate-50 px-3 py-2 text-sm text-slate-500 outline-none";
const labelClass = "mb-1 block text-xs font-semibold uppercase text-slate-500";

export default function BasicInfoStep({ initialValue, onNext }) {
  const [form, setForm] = useState({
    fullName: initialValue?.display_name || initialValue?.name || "",
    dateOfBirth: initialValue?.date_of_birth || "",
    languages: (initialValue?.languages_spoken || initialValue?.languages || []).join(", "),
    experienceYears: initialValue?.experience_years ?? "",
    address: initialValue?.address || "",
    city: initialValue?.city || "",
    pin: initialValue?.pin || "",
  });
  const [saving, setSaving] = useState(false);

  // initialValue arrives asynchronously (the wizard fetches the
  // profile after this component has already mounted), so the
  // useState initializer above usually runs before it exists --
  // without this, the Full Name field looked blank and had to be
  // retyped even though it was already captured at registration.
  const syncedInitialValueRef = useRef(false);
  useEffect(() => {
    if (!initialValue || syncedInitialValueRef.current) return;
    syncedInitialValueRef.current = true;
    setForm({
      fullName: initialValue.display_name || initialValue.name || "",
      dateOfBirth: initialValue.date_of_birth || "",
      languages: (initialValue.languages_spoken || initialValue.languages || []).join(", "),
      experienceYears: initialValue.experience_years ?? "",
      address: initialValue.address || "",
      city: initialValue.city || "",
      pin: initialValue.pin || "",
    });
  }, [initialValue]);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate() {
    if (!form.fullName.trim()) return "Please enter your full name.";
    if (!form.dateOfBirth) return "Please enter your date of birth.";
    if (!form.languages.trim()) return "Please enter at least one language you speak.";
    if (form.experienceYears === "" || Number(form.experienceYears) < 0) {
      return "Please enter your years of experience.";
    }
    if (!form.address.trim()) return "Please enter your address.";
    if (!form.city.trim()) return "Please enter your city.";
    if (!form.pin.trim()) return "Please enter your PIN code.";
    return null;
  }

  async function handleNext() {
    const validationError = validate();
    if (validationError) {
      showError(validationError);
      return;
    }

    setSaving(true);
    try {
      const { pandit } = await savePanditProfile({
        full_name: form.fullName.trim(),
        date_of_birth: form.dateOfBirth,
        languages: form.languages.split(",").map((item) => item.trim()).filter(Boolean),
        experience_years: Number(form.experienceYears),
        address: form.address.trim(),
        city: form.city.trim(),
        pin: form.pin.trim(),
      });
      onNext(pandit);
    } catch (error) {
      showError(error?.message || t("Could not save your basic information."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className={labelClass}>{t("Full Name")}</span>
          <input
            value={form.fullName}
            readOnly
            disabled
            title={t("Set during registration to match your Aadhaar card. Contact admin if this needs to change.")}
            className={disabledInputClass}
          />
          <p className="mt-1 text-xs text-slate-400">
            {t("This is the name you registered with. It has to match your Aadhaar card, so it can't be changed here.")}
          </p>
        </label>

        <label className="block">
          <span className={labelClass}>{t("Date of Birth *")}</span>
          <input
            type="date"
            value={form.dateOfBirth}
            onChange={(event) => updateField("dateOfBirth", event.target.value)}
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className={labelClass}>{t("Years of Experience *")}</span>
          <input
            type="number"
            min="0"
            value={form.experienceYears}
            onChange={(event) => updateField("experienceYears", event.target.value)}
            placeholder="e.g. 12"
            className={inputClass}
          />
        </label>

        <label className="block md:col-span-2">
          <span className={labelClass}>{t("Languages Spoken (comma separated) *")}</span>
          <input
            value={form.languages}
            onChange={(event) => updateField("languages", event.target.value)}
            placeholder={t("Hindi, Sanskrit, English")}
            className={inputClass}
          />
        </label>

        <label className="block md:col-span-2">
          <span className={labelClass}>{t("Address *")}</span>
          <textarea
            value={form.address}
            onChange={(event) => updateField("address", event.target.value)}
            rows={2}
            placeholder={t("House no., street, locality")}
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className={labelClass}>{t("City *")}</span>
          <input
            value={form.city}
            onChange={(event) => updateField("city", event.target.value)}
            placeholder={t("e.g. Jaipur")}
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className={labelClass}>{t("PIN Code *")}</span>
          <input
            value={form.pin}
            onChange={(event) => updateField("pin", event.target.value)}
            placeholder="e.g. 302001"
            className={inputClass}
          />
        </label>
      </div>

      <div className="flex justify-end">
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
