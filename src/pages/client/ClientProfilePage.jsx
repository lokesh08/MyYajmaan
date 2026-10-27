import { useEffect, useState } from "react";

import { useClientPortal } from "../../context/ClientPortalContext";
import { saveMyProfile } from "../../services/clientApi";
import { showError, showSuccess } from "../../utils/toaster";

const GENDER_OPTIONS = ["Male", "Female", "Other"];
const LANGUAGE_OPTIONS = [
  { value: "english", label: "English" },
  { value: "hindi", label: "Hindi" },
  { value: "marathi", label: "Marathi" },
  { value: "gujarati", label: "Gujarati" },
];

const inputClass =
  "w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";
const labelClass = "mb-1 block text-xs font-semibold uppercase text-slate-500";

export default function ClientProfilePage() {
  const { profile, loading, refetch } = useClientPortal();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setForm({
      fullName: profile.full_name || "",
      phone: profile.phone || "",
      dateOfBirth: profile.date_of_birth || "",
      gender: profile.gender || "",
      address: profile.address || "",
      language: profile.language || "",
    });
  }, [profile]);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate() {
    if (!form.fullName.trim()) return "Please enter your full name.";
    if (!form.phone.trim()) return "Please enter your mobile number.";
    if (!form.dateOfBirth) return "Please enter your date of birth.";
    if (!form.gender) return "Please select your gender.";
    if (!form.address.trim()) return "Please enter your address.";
    if (!form.language) return "Please select your preferred language.";
    return null;
  }

  async function handleSave() {
    const validationError = validate();
    if (validationError) {
      showError(validationError);
      return;
    }

    setSaving(true);
    try {
      await saveMyProfile({
        full_name: form.fullName.trim(),
        phone: form.phone.trim(),
        date_of_birth: form.dateOfBirth,
        gender: form.gender,
        address: form.address.trim(),
        language: form.language,
      });
      showSuccess("Profile updated successfully.");
      refetch();
    } catch (error) {
      showError(error?.message || "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !form) {
    return <p className="py-10 text-center text-sm text-slate-400">Loading your profile...</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-2xl font-semibold text-maroon">My Profile</h1>

      <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className={labelClass}>Full Name *</span>
            <input value={form.fullName} onChange={(e) => updateField("fullName", e.target.value)} className={inputClass} />
          </label>

          <label className="block">
            <span className={labelClass}>Email</span>
            <input value={profile.email || ""} disabled className={inputClass} />
          </label>

          <label className="block">
            <span className={labelClass}>Mobile Number *</span>
            <input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} className={inputClass} />
          </label>

          <label className="block">
            <span className={labelClass}>Date of Birth *</span>
            <input
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => updateField("dateOfBirth", e.target.value)}
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className={labelClass}>Gender *</span>
            <select value={form.gender} onChange={(e) => updateField("gender", e.target.value)} className={inputClass}>
              <option value="">Select gender</option>
              {GENDER_OPTIONS.map((option) => (
                <option key={option} value={option.toLowerCase()}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block md:col-span-2">
            <span className={labelClass}>Address *</span>
            <textarea
              value={form.address}
              onChange={(e) => updateField("address", e.target.value)}
              rows={2}
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className={labelClass}>Preferred Language *</span>
            <select value={form.language} onChange={(e) => updateField("language", e.target.value)} className={inputClass}>
              <option value="">Select language</option>
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="interactive-button rounded-full bg-maroon px-6 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Update Profile"}
          </button>
        </div>
      </div>
    </div>
  );
}
