import { useEffect, useState } from "react";

import Modal from "../Modal";
import { createCoupon, listAdminPujas, updateCoupon } from "../../services/adminApi";
import { showError, showSuccess } from "../../utils/toaster";

const REFERRAL_TYPE_OPTIONS = [
  { value: "referral_signup", label: "Referral — Friend Signs Up" },
  { value: "referral_booking", label: "Referral — Friend's First Booking" },
];

const EMPTY_FORM = {
  code: "",
  description: "",
  discount_type: "flat",
  discount_value: "",
  max_discount_amount: "",
  min_booking_amount: "",
  applicable_puja_ids: [],
  usage_limit_total: "",
  usage_limit_per_user: "",
  valid_from: "",
  valid_until: "",
  is_active: true,
  coupon_type: "general",
};

function toDateInput(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

export default function CouponFormModal({ coupon, tab, open, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [pujas, setPujas] = useState([]);
  const [saving, setSaving] = useState(false);

  const isEdit = Boolean(coupon);
  const isReferralTab = tab === "referral";

  useEffect(() => {
    if (!open) return;

    if (coupon) {
      setForm({
        code: coupon.code || "",
        description: coupon.description || "",
        discount_type: coupon.discount_type || "flat",
        discount_value: coupon.discount_value ?? "",
        max_discount_amount: coupon.max_discount_amount ?? "",
        min_booking_amount: coupon.min_booking_amount ?? "",
        applicable_puja_ids: coupon.applicable_puja_ids || [],
        usage_limit_total: coupon.usage_limit_total ?? "",
        usage_limit_per_user: coupon.usage_limit_per_user ?? "",
        valid_from: toDateInput(coupon.valid_from),
        valid_until: toDateInput(coupon.valid_until),
        is_active: coupon.is_active ?? true,
        coupon_type: coupon.coupon_type || (isReferralTab ? "referral_signup" : "general"),
      });
    } else {
      setForm({
        ...EMPTY_FORM,
        coupon_type: isReferralTab ? "referral_signup" : "general",
      });
    }
  }, [open, coupon, isReferralTab]);

  useEffect(() => {
    if (!open || isReferralTab) return;
    listAdminPujas({ pageSize: 100 })
      .then((data) => setPujas(data?.items || []))
      .catch(() => setPujas([]));
  }, [open, isReferralTab]);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function togglePuja(pujaId) {
    setForm((current) => {
      const selected = current.applicable_puja_ids.includes(pujaId);
      return {
        ...current,
        applicable_puja_ids: selected
          ? current.applicable_puja_ids.filter((id) => id !== pujaId)
          : [...current.applicable_puja_ids, pujaId],
      };
    });
  }

  async function handleSave() {
    const cleanCode = form.code.trim();
    if (!cleanCode) {
      showError("Please enter a coupon code.");
      return;
    }
    if (!form.discount_value || Number(form.discount_value) <= 0) {
      showError("Please enter a discount value greater than 0.");
      return;
    }

    const payload = {
      code: cleanCode,
      description: form.description.trim() || "—",
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      max_discount_amount: form.max_discount_amount ? Number(form.max_discount_amount) : null,
      min_booking_amount: form.min_booking_amount ? Number(form.min_booking_amount) : null,
      applicable_puja_ids: isReferralTab ? [] : form.applicable_puja_ids,
      usage_limit_total: form.usage_limit_total ? Number(form.usage_limit_total) : null,
      usage_limit_per_user: form.usage_limit_per_user ? Number(form.usage_limit_per_user) : null,
      valid_from: form.valid_from || null,
      valid_until: form.valid_until || null,
      is_active: form.is_active,
      coupon_type: form.coupon_type,
    };

    setSaving(true);
    try {
      if (isEdit) {
        await updateCoupon(coupon.id, payload);
        showSuccess("Coupon updated successfully.");
      } else {
        await createCoupon(payload);
        showSuccess("Coupon created successfully.");
      }
      onSaved?.();
      onClose();
    } catch (error) {
      showError(error?.data?.detail?.message || error?.data?.detail || error?.message || "Could not save this coupon.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Coupon" : isReferralTab ? "Add Referral Reward" : "Add Coupon"} size="lg">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Coupon Code *</span>
          <input
            value={form.code}
            onChange={(event) => updateField("code", event.target.value.toUpperCase())}
            placeholder="e.g. GANESH100"
            className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
          />
        </label>

        {isReferralTab && (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Reward Type</span>
            <select
              value={form.coupon_type}
              onChange={(event) => updateField("coupon_type", event.target.value)}
              className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
            >
              {REFERRAL_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block md:col-span-2">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Description</span>
          <input
            value={form.description}
            onChange={(event) => updateField("description", event.target.value)}
            placeholder="Shown internally to describe what this coupon is for"
            className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Discount Type</span>
          <div className="flex gap-2">
            {["flat", "percentage"].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => updateField("discount_type", type)}
                className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold capitalize transition ${
                  form.discount_type === type ? "border-maroon bg-maroon text-white" : "border-amber-200 text-slate-600 hover:bg-amber-50"
                }`}
              >
                {type === "flat" ? "₹ Flat" : "% Percentage"}
              </button>
            ))}
          </div>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Discount Value *</span>
          <input
            type="number"
            min="0"
            value={form.discount_value}
            onChange={(event) => updateField("discount_value", event.target.value)}
            placeholder={form.discount_type === "percentage" ? "e.g. 20" : "e.g. 100"}
            className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
          />
        </label>

        {!isReferralTab && (
          <>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Max Discount Amount</span>
              <input
                type="number"
                min="0"
                value={form.max_discount_amount}
                onChange={(event) => updateField("max_discount_amount", event.target.value)}
                placeholder="Cap for % discounts (optional)"
                className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Min Booking Amount</span>
              <input
                type="number"
                min="0"
                value={form.min_booking_amount}
                onChange={(event) => updateField("min_booking_amount", event.target.value)}
                placeholder="Optional minimum order value"
                className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Usage Limit (total)</span>
              <input
                type="number"
                min="0"
                value={form.usage_limit_total}
                onChange={(event) => updateField("usage_limit_total", event.target.value)}
                placeholder="Unlimited if left blank"
                className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Usage Limit (per user)</span>
              <input
                type="number"
                min="0"
                value={form.usage_limit_per_user}
                onChange={(event) => updateField("usage_limit_per_user", event.target.value)}
                placeholder="Unlimited if left blank"
                className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
              />
            </label>
          </>
        )}

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Valid From</span>
          <input
            type="date"
            value={form.valid_from}
            onChange={(event) => updateField("valid_from", event.target.value)}
            className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Valid Till</span>
          <input
            type="date"
            value={form.valid_until}
            onChange={(event) => updateField("valid_until", event.target.value)}
            className="w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
          />
        </label>

        {!isReferralTab && pujas.length > 0 && (
          <div className="block md:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              Applicable Pujas (leave empty for all pujas)
            </span>
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-amber-200 p-2">
              {pujas.map((puja) => (
                <button
                  key={puja.id}
                  type="button"
                  onClick={() => togglePuja(puja.id)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    form.applicable_puja_ids.includes(puja.id)
                      ? "bg-maroon text-white"
                      : "bg-amber-50 text-slate-600 hover:bg-amber-100"
                  }`}
                >
                  {puja.title}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="flex items-center gap-2 md:col-span-2">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(event) => updateField("is_active", event.target.checked)}
            className="h-4 w-4 rounded border-amber-300 text-maroon focus:ring-amber-200"
          />
          <span className="text-sm text-slate-600">
            Active{isReferralTab ? " (activating this pauses any other active reward of the same type)" : ""}
          </span>
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
          {saving ? "Saving..." : "Save Coupon"}
        </button>
      </div>
    </Modal>
  );
}
