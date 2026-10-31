import { useState } from "react";

import AadharVerificationCard from "../AadharVerificationCard";
import { savePanditBankDetails, savePanditDocuments } from "../../../services/panditApi";
import { showError } from "../../../utils/toaster";
import { t } from "../../../i18n";

const inputClass =
  "w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100";
const labelClass = "mb-1 block text-xs font-semibold uppercase text-slate-500";

function FileTile({ label, file, preview, onChange }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-white p-3">
      <p className={labelClass}>{label}</p>
      {preview && <img src={preview} alt={label} className="mb-2 h-28 w-full rounded-lg object-cover" />}
      <input
        type="file"
        accept="image/*"
        onChange={(event) => onChange(event.target.files?.[0])}
        className="w-full text-xs text-slate-500 file:mr-3 file:rounded-full file:border-0 file:bg-amber-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-maroon"
      />
      {file && <p className="mt-1 truncate text-xs text-emerald-600">{file.name}</p>}
    </div>
  );
}

export default function DocumentsStep({ onNext, onBack }) {
  const [aadharDone, setAadharDone] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const [bankForm, setBankForm] = useState({
    accountHolderName: "",
    bankName: "",
    accountNumber: "",
    ifsc: "",
    upiId: "",
  });

  const [submitting, setSubmitting] = useState(false);

  function handleFile(setFile, setPreview, file) {
    if (!file) return;
    setFile(file);
    setPreview(URL.createObjectURL(file));
  }

  function updateBankField(key, value) {
    setBankForm((current) => ({ ...current, [key]: value }));
  }

  function isBankFormPartiallyFilled() {
    return Object.values(bankForm).some((value) => value.trim());
  }

  function validate() {
    if (!photo) return "Please upload a passport-size photo.";

    if (isBankFormPartiallyFilled()) {
      if (!bankForm.accountHolderName.trim()) return "Please enter the account holder name.";
      if (!bankForm.bankName.trim()) return "Please enter the bank name.";
      if (!bankForm.accountNumber.trim()) return "Please enter the account number.";
      if (!bankForm.ifsc.trim()) return "Please enter the IFSC code.";
    }

    return null;
  }

  async function handleSubmit() {
    const validationError = validate();
    if (validationError) {
      showError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      await savePanditDocuments({ photo });

      if (isBankFormPartiallyFilled()) {
        await savePanditBankDetails({
          account_holder_name: bankForm.accountHolderName.trim(),
          bank_name: bankForm.bankName.trim(),
          account_number: bankForm.accountNumber.trim(),
          ifsc: bankForm.ifsc.trim(),
          upi_id: bankForm.upiId.trim() || undefined,
        });
      }

      onNext();
    } catch (error) {
      showError(error?.message || t("Could not submit your documents."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-700">{t("Aadhaar Authentication *")}</p>
        <AadharVerificationCard onVerified={() => setAadharDone(true)} />
      </div>

      {aadharDone && (
        <>
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">{t("Passport-size Photo *")}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <FileTile
                label={t("Passport-size Photo")}
                file={photo}
                preview={photoPreview}
                onChange={(file) => handleFile(setPhoto, setPhotoPreview, file)}
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">
              {t("Bank Account Details")}{' '}<span className="font-normal text-slate-400">{t("(optional for now — required later to receive payments)")}</span>
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className={labelClass}>{t("Account Holder Name")}</span>
                <input
                  value={bankForm.accountHolderName}
                  onChange={(event) => updateBankField("accountHolderName", event.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className={labelClass}>{t("Bank Name")}</span>
                <input
                  value={bankForm.bankName}
                  onChange={(event) => updateBankField("bankName", event.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className={labelClass}>{t("Account Number")}</span>
                <input
                  value={bankForm.accountNumber}
                  onChange={(event) => updateBankField("accountNumber", event.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className={labelClass}>{t("IFSC Code")}</span>
                <input
                  value={bankForm.ifsc}
                  onChange={(event) => updateBankField("ifsc", event.target.value.toUpperCase())}
                  className={inputClass}
                />
              </label>
              <label className="block md:col-span-2">
                <span className={labelClass}>{t("UPI ID")}</span>
                <input
                  value={bankForm.upiId}
                  onChange={(event) => updateBankField("upiId", event.target.value)}
                  placeholder={t("yourname@upi")}
                  className={inputClass}
                />
              </label>
            </div>
          </div>
        </>
      )}

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
          onClick={handleSubmit}
          disabled={submitting || !aadharDone}
          title={!aadharDone ? t("Please complete Aadhaar authentication first") : t("Submit registration")}
          className="interactive-button rounded-full bg-maroon px-6 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? t("Submitting...") : t("Submit Registration")}
        </button>
      </div>
    </div>
  );
}
