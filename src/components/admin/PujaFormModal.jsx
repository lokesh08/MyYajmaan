import { useEffect, useState } from "react";

import Modal from "../Modal";
import { createPuja, updatePuja } from "../../services/adminApi";
import { showError, showSuccess } from "../../utils/toaster";

const CATEGORIES = ["Festival", "Family", "Housewarming", "Temple", "Path", "Remedy"];

const LISTING_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "trending", label: "Trending" },
  { value: "featured", label: "Featured" },
];

const PUJA_TYPE_OPTIONS = [
  { value: "normal", label: "Normal Puja" },
  { value: "package", label: "Package Puja" },
];

const EMPTY_FORM = {
  title: "",
  category: CATEGORIES[0],
  durationMinutes: "",
  basePrice: "",
  description: "",
  benefits: "",
  listingType: "normal",
  pujaType: "normal",
  isActive: true,
};

export default function PujaFormModal({ puja, open, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState(null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  const isEdit = Boolean(puja);

  useEffect(() => {
    if (!open) return;

    if (puja) {
      setForm({
        title: puja.title || "",
        category: puja.category || CATEGORIES[0],
        durationMinutes: puja.duration_minutes ?? "",
        basePrice: puja.base_price ?? "",
        description: puja.description || "",
        benefits: (puja.metadata?.benefits || []).join(", "),
        listingType: puja.listing_type || "normal",
        pujaType: puja.puja_type || "normal",
        isActive: puja.is_active ?? true,
      });
      setImagePreview(puja.image_url || null);
      setThumbnailPreview(puja.thumbnail_url || null);
    } else {
      setForm(EMPTY_FORM);
      setImagePreview(null);
      setThumbnailPreview(null);
    }

    setImageFile(null);
    setThumbnailFile(null);
  }, [open, puja]);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleFileChange(kind, file) {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);

    if (kind === "image") {
      setImageFile(file);
      setImagePreview(previewUrl);
    } else {
      setThumbnailFile(file);
      setThumbnailPreview(previewUrl);
    }
  }

  async function handleSave() {
    const cleanTitle = form.title.trim();
    if (!cleanTitle) {
      showError("Please enter a puja name.");
      return;
    }

    const fields = {
      title: cleanTitle,
      category: form.category,
      duration_minutes: form.durationMinutes || undefined,
      base_price: form.basePrice || undefined,
      description: form.description,
      benefits: form.benefits,
      listing_type: form.listingType,
      puja_type: form.pujaType,
      is_active: form.isActive,
      image: imageFile || undefined,
      thumbnail: thumbnailFile || undefined,
    };

    setSaving(true);
    try {
      if (isEdit) {
        await updatePuja(puja.id, fields);
        showSuccess("Puja updated successfully.");
      } else {
        await createPuja(fields);
        showSuccess("Puja created successfully.");
      }
      onSaved?.();
      onClose();
    } catch (error) {
      showError(error?.data?.detail?.message || error?.message || "Could not save this puja.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Puja" : "Add New Puja"} size="lg">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Puja Name *</span>
          <input
            value={form.title}
            onChange={(event) => updateField("title", event.target.value)}
            placeholder="e.g. Hanuman Chalisa Path"
            className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Category</span>
          <select
            value={form.category}
            onChange={(event) => updateField("category", event.target.value)}
            className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
          >
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Duration (minutes)</span>
          <input
            type="number"
            min="0"
            value={form.durationMinutes}
            onChange={(event) => updateField("durationMinutes", event.target.value)}
            placeholder="e.g. 90"
            className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Base Price (Starting from) *</span>
          <input
            type="number"
            min="0"
            value={form.basePrice}
            onChange={(event) => updateField("basePrice", event.target.value)}
            placeholder="e.g. 1099"
            className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Listing Type</span>
          <div className="flex gap-2">
            {LISTING_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => updateField("listingType", option.value)}
                className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  form.listingType === option.value
                    ? "border-maroon bg-maroon text-white"
                    : "border-amber-200 text-slate-600 hover:bg-amber-50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </label>

        <label className="block md:col-span-2">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Description</span>
          <textarea
            value={form.description}
            onChange={(event) => updateField("description", event.target.value)}
            rows={3}
            placeholder="Group chanting of Hanuman Chalisa for strength, peace and protection"
            className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
          />
        </label>

        <label className="block md:col-span-2">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
            Benefits (comma separated)
          </span>
          <input
            value={form.benefits}
            onChange={(event) => updateField("benefits", event.target.value)}
            placeholder="Peace, Prosperity, Protection, Strength"
            className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
          />
        </label>

        <div className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Big Image</span>
          {imagePreview && (
            <img src={imagePreview} alt="Puja preview" className="mb-2 h-28 w-full rounded-xl object-cover" />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(event) => handleFileChange("image", event.target.files?.[0])}
            className="w-full text-xs text-slate-500 file:mr-3 file:rounded-full file:border-0 file:bg-amber-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-maroon"
          />
        </div>

        <div className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Thumbnail Image</span>
          {thumbnailPreview && (
            <img
              src={thumbnailPreview}
              alt="Thumbnail preview"
              className="mb-2 h-28 w-full rounded-xl object-cover"
            />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(event) => handleFileChange("thumbnail", event.target.files?.[0])}
            className="w-full text-xs text-slate-500 file:mr-3 file:rounded-full file:border-0 file:bg-amber-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-maroon"
          />
        </div>

        <label className="flex items-center gap-2 md:col-span-2">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) => updateField("isActive", event.target.checked)}
            className="h-4 w-4 rounded border-amber-300 text-maroon focus:ring-amber-200"
          />
          <span className="text-sm text-slate-600">Active (visible on the app when saved)</span>
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
          {saving ? "Saving..." : "Save Puja"}
        </button>
      </div>
    </Modal>
  );
}
