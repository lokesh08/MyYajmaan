import { useEffect, useMemo, useState } from "react";

import {
  addMyAddress,
  deleteMyAddress,
  listCities,
  listMyAddresses,
  setDefaultAddress,
  updateMyAddress,
} from "../../services/clientApi";
import { showError, showSuccess } from "../../utils/toaster";
import Modal from "../../components/Modal";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import { t } from "../../i18n";

const LABEL_SUGGESTIONS = ["Home", "Office", "Other"];
const EMPTY_FORM = { label: "", addressLine: "", state: "", city: "", pincode: "" };

const inputClass =
  "w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";
const labelClass = "mb-1 block text-xs font-semibold uppercase text-slate-500";

function AddressFormModal({ open, onClose, address, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  // Home/Office are fixed labels (not user-editable text); Other is a
  // free-text label the user types themselves.
  const [labelEditable, setLabelEditable] = useState(false);
  const [cities, setCities] = useState([]);
  const [loadingCities, setLoadingCities] = useState(true);
  const isEdit = Boolean(address);

  useEffect(() => {
    if (!open) return;
    listCities()
      .then((data) => setCities(Array.isArray(data) ? data : []))
      .catch(() => showError(t("Could not load the state/city list.")))
      .finally(() => setLoadingCities(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (address) {
      const isKnownLabel = LABEL_SUGGESTIONS.slice(0, 2).includes(address.label);
      setLabelEditable(!isKnownLabel);
      setForm({
        label: address.label || "",
        addressLine: address.address_line || "",
        state: address.state || "",
        city: address.city || "",
        pincode: address.pincode || "",
      });
    } else {
      setLabelEditable(false);
      setForm(EMPTY_FORM);
    }
  }, [open, address]);

  const states = useMemo(() => [...new Set(cities.map((c) => c.state))].sort(), [cities]);
  const citiesForState = useMemo(
    () => cities.filter((c) => c.state === form.state).sort((a, b) => a.name.localeCompare(b.name)),
    [cities, form.state],
  );

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function selectLabel(suggestion) {
    if (suggestion === "Other") {
      setLabelEditable(true);
      // Keep whatever custom text was already there; otherwise start blank.
      updateField("label", LABEL_SUGGESTIONS.slice(0, 2).includes(form.label) ? "" : form.label);
    } else {
      setLabelEditable(false);
      updateField("label", suggestion);
    }
  }

  function updateState(value) {
    setForm((current) => ({ ...current, state: value, city: "" }));
  }

  async function handleSave() {
    if (!form.label.trim() || !form.addressLine.trim() || !form.state.trim() || !form.city.trim() || !form.pincode.trim()) {
      showError(t("Please fill in all address fields."));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        label: form.label.trim(),
        address_line: form.addressLine.trim(),
        state: form.state.trim(),
        city: form.city.trim(),
        pincode: form.pincode.trim(),
      };
      if (isEdit) {
        await updateMyAddress(address.id, payload);
        showSuccess(t("Address updated successfully."));
      } else {
        await addMyAddress(payload);
        showSuccess(t("Address added successfully."));
      }
      onSaved();
      onClose();
    } catch (error) {
      showError(error?.message || t("Could not save this address."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? t("Edit Address") : t("Add Address")} size="md">
      <div className="space-y-4">
        <div>
          <span className={labelClass}>{t("Label")}</span>
          <div className="mb-2 flex flex-wrap gap-2">
            {LABEL_SUGGESTIONS.map((suggestion) => {
              const isActive = suggestion === "Other" ? labelEditable : !labelEditable && form.label === suggestion;
              return (
                <button
                  key={suggestion}
                  type="button"
                  title={t("Use \"{suggestion}\" as this address's label", { suggestion: suggestion })}
                  onClick={() => selectLabel(suggestion)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    isActive ? "border-maroon bg-maroon text-white" : "border-amber-200 text-slate-600 hover:bg-amber-50"
                  }`}
                >
                  {suggestion}
                </button>
              );
            })}
          </div>
          <input
            value={form.label}
            onChange={(e) => updateField("label", e.target.value)}
            placeholder={labelEditable ? t("e.g. Mother's House") : t("e.g. Home")}
            disabled={!labelEditable}
            title={labelEditable ? t("Enter a custom label for this address") : t("Choose \"Other\" to enter a custom label")}
            className={inputClass}
          />
        </div>

        <label className="block">
          <span className={labelClass}>{t("Address *")}</span>
          <textarea
            value={form.addressLine}
            onChange={(e) => updateField("addressLine", e.target.value)}
            rows={3}
            placeholder={t("House/Flat number, street, locality")}
            title={t("Full address")}
            className={inputClass}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>{t("State *")}</span>
            <select
              value={form.state}
              onChange={(e) => updateState(e.target.value)}
              disabled={loadingCities}
              title={t("Select your state")}
              className={inputClass}
            >
              <option value="">{loadingCities ? t("Loading...") : t("Select State")}</option>
              {states.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>{t("City *")}</span>
            <select
              value={form.city}
              onChange={(e) => updateField("city", e.target.value)}
              disabled={!form.state}
              title={form.state ? t("Select your city") : t("Select a state first")}
              className={inputClass}
            >
              <option value="">{form.state ? t("Select City") : t("Select a state first")}</option>
              {citiesForState.map((city) => (
                <option key={city.id} value={city.name}>
                  {city.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className={labelClass}>{t("Pincode *")}</span>
          <input value={form.pincode} onChange={(e) => updateField("pincode", e.target.value)} title={t("Pincode")} className={inputClass} />
        </label>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          title={t("Discard changes and close")}
          className="interactive-button rounded-full border border-amber-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-amber-50"
        >
          {t("Cancel")}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          title={t("Save this address")}
          className="interactive-button rounded-full bg-maroon px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? t("Saving...") : t("Save Address")}
        </button>
      </div>
    </Modal>
  );
}

export default function ClientAddressesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [settingDefaultId, setSettingDefaultId] = useState(null);

  function load() {
    setLoading(true);
    listMyAddresses()
      .then((data) => setItems(data?.items || []))
      .catch(() => showError(t("Could not load your addresses.")))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function openAdd() {
    setEditingAddress(null);
    setFormOpen(true);
  }

  function openEdit(address) {
    setEditingAddress(address);
    setFormOpen(true);
  }

  async function handleSetDefault(address) {
    setSettingDefaultId(address.id);
    try {
      await setDefaultAddress(address.id);
      showSuccess(t("Default address updated."));
      load();
    } catch (error) {
      showError(error?.message || t("Could not update default address."));
    } finally {
      setSettingDefaultId(null);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMyAddress(deleteTarget.id);
      showSuccess(t("Address deleted successfully."));
      setDeleteTarget(null);
      load();
    } catch (error) {
      showError(error?.message || t("Could not delete this address."));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl font-semibold text-maroon">{t("Addresses")}</h1>
        <button
          type="button"
          onClick={openAdd}
          className="interactive-button rounded-full bg-maroon px-5 py-2.5 text-sm font-semibold text-white hover:bg-maroon"
        >
          {t("+ Add Address")}
        </button>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">{t("Loading...")}</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-amber-100 bg-white p-8 text-center text-sm text-slate-400">
          {t("You haven't added any addresses yet.")}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((address) => (
            <div key={address.id} className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-maroon">{t(address.label)}</span>
                  {address.is_default && (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">{t("Default")}</span>
                  )}
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-700">{address.address_line}</p>
              <p className="text-sm text-slate-500">
                {[address.city, address.state].filter(Boolean).join(", ")} - {address.pincode}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {!address.is_default && (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(address)}
                    disabled={settingDefaultId === address.id}
                    className="interactive-button rounded-full border border-amber-200 px-3 py-1.5 text-xs font-semibold text-maroon hover:bg-amber-50 disabled:opacity-60"
                  >
                    {settingDefaultId === address.id ? t("Setting...") : t("Set as Default")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openEdit(address)}
                  className="interactive-button rounded-full border border-amber-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-amber-50"
                >
                  {t("Edit")}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(address)}
                  className="interactive-button rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                >
                  {t("Delete")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddressFormModal open={formOpen} onClose={() => setFormOpen(false)} address={editingAddress} onSaved={load} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t("Delete Address")}
        message={t("Delete the \"{v0}\" address?", { v0: deleteTarget?.label || "" })}
        confirmLabel={t("Delete")}
        confirmClassName="bg-rose-600 hover:bg-rose-700"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
