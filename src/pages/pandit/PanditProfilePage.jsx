import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { usePanditPortal } from "../../context/PanditPortalContext";
import AadharVerificationCard from "../../components/pandit/AadharVerificationCard";
import {
  getPanditBankDetails,
  getPanditDocuments,
  getPanditProfile,
  listMyPujas,
  savePanditAvailability,
  savePanditBankDetails,
  savePanditDocuments,
  savePanditProfile,
} from "../../services/panditApi";
import { showError, showSuccess } from "../../utils/toaster";
import { t } from "../../i18n";

const TABS = [
  { key: "profile", label: "Profile" },
  { key: "services", label: "Services" },
  { key: "availability", label: "Availability" },
  { key: "aadhar", label: "Aadhaar" },
  { key: "documents", label: "Documents" },
  { key: "bank", label: "Bank Details" },
];

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

const inputClass =
  "w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";
const labelClass = "mb-1 block text-xs font-semibold uppercase text-slate-500";

function LockedBanner({ stage, rejectionReason }) {
  if (stage === "pending") {
    return (
      <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {t("Your profile is under admin review. You can view your details below, but editing is disabled until the review is complete.")}
      </div>
    );
  }
  if (stage === "rejected") {
    return (
      <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        <p className="font-semibold">{t("Your registration was declined.")}</p>
        {rejectionReason && <p className="mt-1">{t("Admin's note:")}{' '}{rejectionReason}</p>}
        <p className="mt-1">{t("Update the details/documents below and re-submit to be reviewed again.")}</p>
      </div>
    );
  }
  return null;
}

function ProfileTab({ locked }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPanditProfile()
      .then((data) => {
        const pandit = data?.pandit || {};
        setForm({
          fullName: pandit.display_name || pandit.name || "",
          dateOfBirth: pandit.date_of_birth || "",
          languages: (pandit.languages_spoken || pandit.languages || []).join(", "),
          experienceYears: pandit.experience_years ?? "",
          address: pandit.address || "",
          city: pandit.city || "",
          pin: pandit.pin || "",
        });
      })
      .catch(() => showError(t("Could not load your profile.")))
      .finally(() => setLoading(false));
  }, []);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await savePanditProfile({
        full_name: form.fullName.trim(),
        date_of_birth: form.dateOfBirth,
        languages: form.languages.split(",").map((item) => item.trim()).filter(Boolean),
        experience_years: Number(form.experienceYears),
        address: form.address.trim(),
        city: form.city.trim(),
        pin: form.pin.trim(),
      });
      showSuccess(t("Profile updated successfully."));
    } catch (error) {
      showError(error?.message || t("Could not save your profile."));
    } finally {
      setSaving(false);
    }
  }

  if (loading || !form) return <p className="py-6 text-center text-sm text-slate-400">{t("Loading...")}</p>;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className={labelClass}>{t("Full Name")}</span>
          <input disabled={locked} value={form.fullName} onChange={(e) => updateField("fullName", e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>{t("Date of Birth")}</span>
          <input
            type="date"
            disabled={locked}
            value={form.dateOfBirth}
            onChange={(e) => updateField("dateOfBirth", e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>{t("Years of Experience")}</span>
          <input
            type="number"
            min="0"
            disabled={locked}
            value={form.experienceYears}
            onChange={(e) => updateField("experienceYears", e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block md:col-span-2">
          <span className={labelClass}>{t("Languages Spoken")}</span>
          <input disabled={locked} value={form.languages} onChange={(e) => updateField("languages", e.target.value)} className={inputClass} />
        </label>
        <label className="block md:col-span-2">
          <span className={labelClass}>{t("Address")}</span>
          <textarea disabled={locked} rows={2} value={form.address} onChange={(e) => updateField("address", e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>{t("City")}</span>
          <input disabled={locked} value={form.city} onChange={(e) => updateField("city", e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>{t("PIN Code")}</span>
          <input disabled={locked} value={form.pin} onChange={(e) => updateField("pin", e.target.value)} className={inputClass} />
        </label>
      </div>

      {!locked && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="interactive-button rounded-full bg-maroon px-6 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? t("Saving...") : t("Save Changes")}
          </button>
        </div>
      )}
    </div>
  );
}

function ServicesTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listMyPujas()
      .then((data) => setItems(data?.items || []))
      .catch(() => showError(t("Could not load your services.")))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="py-6 text-center text-sm text-slate-400">{t("Loading...")}</p>;

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">{t("You haven't added any pujas yet.")}</p>
      ) : (
        <div className="divide-y divide-amber-50 overflow-hidden rounded-2xl border border-amber-100">
          {items.map((row) => (
            <div key={row.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">{row.puja?.title || t("Puja")}</p>
                <p className="text-xs text-slate-400">{row.puja?.duration_minutes ? `${row.puja.duration_minutes} min` : ""}</p>
              </div>
              <p className="text-sm font-semibold text-maroon">{t("Rs.")}{' '}{Number(row.price_override || 0).toFixed(2)}</p>
            </div>
          ))}
        </div>
      )}
      <Link
        to="/pandit/pujas"
        title={t("Manage in My Pujas")}
        className="interactive-button inline-block rounded-full border border-amber-200 px-5 py-2 text-sm font-semibold text-maroon hover:bg-amber-50"
      >
        {t("Manage in My Pujas →")}
      </Link>
    </div>
  );
}

function AvailabilityTab({ locked }) {
  const [days, setDays] = useState([]);
  const [timeslotKey, setTimeslotKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPanditProfile()
      .then((data) => {
        const pattern = data?.pandit?.availability_pattern || {};
        setDays(pattern.days || []);
        const match = TIMESLOTS.find((slot) => slot.start === pattern.start_time && slot.end === pattern.end_time);
        setTimeslotKey(match?.key || "");
      })
      .catch(() => showError(t("Could not load your availability.")))
      .finally(() => setLoading(false));
  }, []);

  function toggleDay(key) {
    setDays((current) => (current.includes(key) ? current.filter((d) => d !== key) : [...current, key]));
  }

  async function handleSave() {
    if (days.length === 0) {
      showError(t("Please select at least one available day."));
      return;
    }
    const timeslot = TIMESLOTS.find((slot) => slot.key === timeslotKey);
    if (!timeslot) {
      showError(t("Please select a timeslot."));
      return;
    }
    setSaving(true);
    try {
      await savePanditAvailability({ days, start_time: timeslot.start, end_time: timeslot.end });
      showSuccess(t("Availability updated successfully."));
    } catch (error) {
      showError(error?.message || t("Could not save your availability."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="py-6 text-center text-sm text-slate-400">{t("Loading...")}</p>;

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-700">{t("Available Days")}</p>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((day) => (
            <button
              key={day.key}
              type="button"
              disabled={locked}
              onClick={() => toggleDay(day.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                days.includes(day.key) ? "border-maroon bg-maroon text-white" : "border-amber-200 text-slate-600 hover:bg-amber-50"
              }`}
            >
              {t(day.label)}
            </button>
          ))}
        </div>
      </div>

      <label className="block max-w-sm">
        <span className={labelClass}>{t("Timeslot")}</span>
        <select disabled={locked} value={timeslotKey} onChange={(e) => setTimeslotKey(e.target.value)} className={inputClass}>
          <option value="">{t("Select a timeslot")}</option>
          {TIMESLOTS.map((slot) => (
            <option key={slot.key} value={slot.key}>
              {t(slot.label)}
            </option>
          ))}
        </select>
      </label>

      {!locked && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="interactive-button rounded-full bg-maroon px-6 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? t("Saving...") : t("Save Changes")}
          </button>
        </div>
      )}
    </div>
  );
}

function AadharTab() {
  return (
    <div className="max-w-lg">
      <AadharVerificationCard onVerified={() => {}} />
    </div>
  );
}

function DocumentsTab({ locked }) {
  const [registration, setRegistration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    setLoading(true);
    getPanditDocuments()
      .then((data) => setRegistration(data?.registration || null))
      .catch(() => showError(t("Could not load your documents.")))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleUpload() {
    if (!photo) {
      showError(t("Please choose a photo to update."));
      return;
    }
    setSubmitting(true);
    try {
      await savePanditDocuments({ photo });
      showSuccess(t("Photo updated successfully."));
      setPhoto(null);
      load();
    } catch (error) {
      showError(error?.message || t("Could not submit your photo."));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="py-6 text-center text-sm text-slate-400">{t("Loading...")}</p>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-amber-200 bg-white p-3">
          <p className={labelClass}>{t("Passport-size Photo")}</p>
          {registration?.photo_url && !photo && (
            <img src={registration.photo_url} alt={t("Passport-size Photo")} className="mb-2 h-28 w-full rounded-lg object-cover" />
          )}
          {!locked && (
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhoto(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-500 file:mr-3 file:rounded-full file:border-0 file:bg-amber-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-maroon"
            />
          )}
        </div>
      </div>

      {!locked && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleUpload}
            disabled={submitting}
            className="interactive-button rounded-full bg-maroon px-6 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? t("Submitting...") : t("Update Photo")}
          </button>
        </div>
      )}
    </div>
  );
}

function BankDetailsTab({ locked }) {
  const [form, setForm] = useState({ accountHolderName: "", bankName: "", accountNumber: "", ifsc: "", upiId: "" });
  const [masked, setMasked] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPanditBankDetails()
      .then((data) => {
        const details = data?.bank_details;
        if (details) {
          setForm((current) => ({
            ...current,
            accountHolderName: details.account_holder_name || "",
            bankName: details.bank_name || "",
            upiId: details.upi_id || "",
          }));
          setMasked({ accountNumber: details.account_number_masked, ifsc: details.ifsc_masked });
        }
      })
      .catch(() => showError(t("Could not load your bank details.")))
      .finally(() => setLoading(false));
  }, []);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave() {
    if (!form.accountHolderName.trim() || !form.bankName.trim()) {
      showError(t("Account holder name and bank name are required."));
      return;
    }

    // Account number/IFSC are only mandatory the very first time --
    // once they're on file, leaving these blank just means "keep the
    // existing one" (e.g. when you're only here to add a UPI ID).
    const hasExistingAccount = Boolean(masked?.accountNumber && masked?.ifsc);
    if (!hasExistingAccount && (!form.accountNumber.trim() || !form.ifsc.trim())) {
      showError(t("Please enter your account number and IFSC code."));
      return;
    }

    setSaving(true);
    try {
      await savePanditBankDetails({
        account_holder_name: form.accountHolderName.trim(),
        bank_name: form.bankName.trim(),
        account_number: form.accountNumber.trim() || undefined,
        ifsc: form.ifsc.trim() || undefined,
        upi_id: form.upiId.trim() || undefined,
      });
      showSuccess(t("Bank details saved successfully."));
      setForm((current) => ({ ...current, accountNumber: "", ifsc: "" }));
      const data = await getPanditBankDetails();
      const details = data?.bank_details;
      if (details) setMasked({ accountNumber: details.account_number_masked, ifsc: details.ifsc_masked });
    } catch (error) {
      showError(error?.message || t("Could not save your bank details."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="py-6 text-center text-sm text-slate-400">{t("Loading...")}</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {t("Bank details are mandatory to receive payments from your bookings.")}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className={labelClass}>{t("Account Holder Name")}</span>
          <input disabled={locked} value={form.accountHolderName} onChange={(e) => updateField("accountHolderName", e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>{t("Bank Name")}</span>
          <input disabled={locked} value={form.bankName} onChange={(e) => updateField("bankName", e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>{t("Account Number")}{' '}{masked?.accountNumber && t("(current: {accountNumber})", { accountNumber: masked.accountNumber })}</span>
          <input
            disabled={locked}
            value={form.accountNumber}
            onChange={(e) => updateField("accountNumber", e.target.value)}
            placeholder={masked?.accountNumber ? t("Enter to replace") : ""}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>{t("IFSC Code")}{' '}{masked?.ifsc && t("(current: {ifsc})", { ifsc: masked.ifsc })}</span>
          <input
            disabled={locked}
            value={form.ifsc}
            onChange={(e) => updateField("ifsc", e.target.value.toUpperCase())}
            placeholder={masked?.ifsc ? t("Enter to replace") : ""}
            className={inputClass}
          />
        </label>
        <label className="block md:col-span-2">
          <span className={labelClass}>{t("UPI ID")}</span>
          <input disabled={locked} value={form.upiId} onChange={(e) => updateField("upiId", e.target.value)} className={inputClass} />
        </label>
      </div>

      {!locked && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="interactive-button rounded-full bg-maroon px-6 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? t("Saving...") : t("Save Bank Details")}
          </button>
        </div>
      )}
    </div>
  );
}

export default function PanditProfilePage() {
  const { stage, rejectionReason } = usePanditPortal();
  const [tab, setTab] = useState("profile");
  const locked = stage === "pending";

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-2xl font-semibold text-maroon">{t("My Profile")}</h1>

      <LockedBanner stage={stage} rejectionReason={rejectionReason} />

      <div className="flex flex-wrap gap-2 rounded-full border border-amber-100 bg-white p-1">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              tab === item.key ? "bg-maroon text-white" : "text-slate-600 hover:bg-amber-50"
            }`}
          >
            {t(item.label)}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm sm:p-6">
        {tab === "profile" && <ProfileTab locked={locked} />}
        {tab === "services" && <ServicesTab />}
        {tab === "availability" && <AvailabilityTab locked={locked} />}
        {tab === "aadhar" && <AadharTab />}
        {tab === "documents" && <DocumentsTab locked={locked} />}
        {tab === "bank" && <BankDetailsTab locked={locked} />}
      </div>
    </div>
  );
}
