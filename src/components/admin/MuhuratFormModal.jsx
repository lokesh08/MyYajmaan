import { useEffect, useState } from "react";

import Modal from "../Modal";
import { createMuhurat, listAdminPujas, updateMuhurat } from "../../services/adminApi";
import { showError, showSuccess } from "../../utils/toaster";

const EMPTY_FORM = {
  title: "",
  description: "",
  start_at: "",
  end_at: "",
  discount_percent: "",
  active: true,
};

function toLocalInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function MuhuratFormModal({ muhrat, open, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [pujaDiscounts, setPujaDiscounts] = useState([]);
  const [pujas, setPujas] = useState([]);
  const [saving, setSaving] = useState(false);

  const isEdit = Boolean(muhrat);

  useEffect(() => {
    if (!open) return;

    if (muhrat) {
      setForm({
        title: muhrat.title || "",
        description: muhrat.description || "",
        start_at: toLocalInput(muhrat.start_at),
        end_at: toLocalInput(muhrat.end_at),
        discount_percent: muhrat.discount_percent ?? "",
        active: muhrat.active ?? true,
      });
      setPujaDiscounts(muhrat.puja_discounts || []);
    } else {
      setForm(EMPTY_FORM);
      setPujaDiscounts([]);
    }
  }, [open, muhrat]);

  useEffect(() => {
    if (!open) return;
    listAdminPujas({ pageSize: 100 })
      .then((data) => setPujas(data?.items || []))
      .catch(() => setPujas([]));
  }, [open]);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function addPujaDiscountRow() {
    if (pujas.length === 0) return;
    setPujaDiscounts((current) => [
      ...current,
      { puja_id: pujas[0].id, puja_title: pujas[0].title, discount_type: "percentage", discount_value: 10 },
    ]);
  }

  function updatePujaDiscountRow(index, key, value) {
    setPujaDiscounts((current) =>
      current.map((row, i) => {
        if (i !== index) return row;
        if (key === "puja_id") {
          const puja = pujas.find((p) => p.id === value);
          return { ...row, puja_id: value, puja_title: puja?.title || row.puja_title };
        }
        return { ...row, [key]: value };
      }),
    );
  }

  function removePujaDiscountRow(index) {
    setPujaDiscounts((current) => current.filter((_, i) => i !== index));
  }

  async function handleSave() {
    const cleanTitle = form.title.trim();
    if (!cleanTitle) {
      showError("Please enter a title.");
      return;
    }
    if (!form.start_at || !form.end_at) {
      showError("Please set both start and end time.");
      return;
    }
    if (new Date(form.end_at) <= new Date(form.start_at)) {
      showError("End time must be after start time.");
      return;
    }

    const payload = {
      title: cleanTitle,
      description: form.description.trim() || null,
      start_at: new Date(form.start_at).toISOString(),
      end_at: new Date(form.end_at).toISOString(),
      discount_percent: form.discount_percent ? Number(form.discount_percent) : null,
      puja_discounts: pujaDiscounts.map((row) => ({
        puja_id: row.puja_id,
        puja_title: row.puja_title,
        discount_type: row.discount_type,
        discount_value: Number(row.discount_value),
      })),
      active: form.active,
    };

    setSaving(true);
    try {
      if (isEdit) {
        await updateMuhurat(muhrat.id, payload);
        showSuccess("Shubh Muhurat updated successfully.");
      } else {
        await createMuhurat(payload);
        showSuccess("Shubh Muhurat created successfully.");
      }
      onSaved?.();
      onClose();
    } catch (error) {
      showError(error?.data?.detail?.message || error?.data?.detail || error?.message || "Could not save this Shubh Muhurat.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Shubh Muhurat" : "Add Shubh Muhurat"} size="lg">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Title *</span>
          <input
            value={form.title}
            onChange={(event) => updateField("title", event.target.value)}
            placeholder="e.g. Abhijit Muhurat"
            className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Starts At *</span>
          <input
            type="datetime-local"
            value={form.start_at}
            onChange={(event) => updateField("start_at", event.target.value)}
            className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Ends At *</span>
          <input
            type="datetime-local"
            value={form.end_at}
            onChange={(event) => updateField("end_at", event.target.value)}
            className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
          />
        </label>

        <label className="block md:col-span-2">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Description</span>
          <textarea
            value={form.description}
            onChange={(event) => updateField("description", event.target.value)}
            rows={2}
            placeholder="Shown to customers when they view this muhurat"
            className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
            Fallback Discount % (applies to all pujas not listed below)
          </span>
          <input
            type="number"
            min="0"
            max="100"
            value={form.discount_percent}
            onChange={(event) => updateField("discount_percent", event.target.value)}
            placeholder="e.g. 15"
            className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
          />
        </label>

        <div className="block md:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500">Per-Puja Discounts</span>
            <button
              type="button"
              onClick={addPujaDiscountRow}
              className="interactive-button rounded-full border border-amber-200 px-3 py-1 text-xs font-semibold text-maroon hover:bg-amber-50"
            >
              + Add Puja
            </button>
          </div>

          {pujaDiscounts.length === 0 && (
            <p className="rounded-xl border border-dashed border-amber-200 px-3 py-4 text-center text-xs text-slate-400">
              No specific pujas added — the fallback discount above applies to everything.
            </p>
          )}

          <div className="space-y-2">
            {pujaDiscounts.map((row, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 p-2">
                <select
                  value={row.puja_id}
                  onChange={(event) => updatePujaDiscountRow(index, "puja_id", event.target.value)}
                  className="min-w-[10rem] flex-1 rounded-lg border border-amber-200 px-2 py-1.5 text-xs outline-none"
                >
                  {pujas.map((puja) => (
                    <option key={puja.id} value={puja.id}>
                      {puja.title}
                    </option>
                  ))}
                </select>
                <select
                  value={row.discount_type}
                  onChange={(event) => updatePujaDiscountRow(index, "discount_type", event.target.value)}
                  className="rounded-lg border border-amber-200 px-2 py-1.5 text-xs outline-none"
                >
                  <option value="percentage">%</option>
                  <option value="flat">₹ Flat</option>
                </select>
                <input
                  type="number"
                  min="0"
                  value={row.discount_value}
                  onChange={(event) => updatePujaDiscountRow(index, "discount_value", event.target.value)}
                  className="w-20 rounded-lg border border-amber-200 px-2 py-1.5 text-xs outline-none"
                />
                <button
                  type="button"
                  onClick={() => removePujaDiscountRow(index)}
                  aria-label="Remove this puja discount"
                  className="rounded-lg border border-rose-200 px-2 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 md:col-span-2">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(event) => updateField("active", event.target.checked)}
            className="h-4 w-4 rounded border-amber-300 text-maroon focus:ring-amber-200"
          />
          <span className="text-sm text-slate-600">Active</span>
        </label>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="interactive-button rounded-full border border-amber-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="interactive-button rounded-full bg-maroon px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Muhurat"}
        </button>
      </div>
    </Modal>
  );
}
