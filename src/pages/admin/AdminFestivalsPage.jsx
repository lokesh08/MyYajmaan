import { useEffect, useState } from "react";

import Modal from "../../components/Modal";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import { createFestival, deleteFestival, listAdminFestivals, updateFestival } from "../../services/adminApi";
import { showError, showSuccess } from "../../utils/toaster";

// Festival calendar: the home page's "Upcoming Festivals" / "Coming up"
// lists and the festival-date check for pujas linked to a festival
// (Admin -> Pujas -> Linked Festival) both read from here. A festival
// that comes every year gets one entry per year with the same name.

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "all", label: "All" },
];

const EMPTY = { title: "", start_date: "", end_date: "", description: "", image_url: "", highlight: false };

const inputClass =
  "w-full rounded-xl border border-amber-200 px-3 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100";

function formatDate(value) {
  if (!value) return "";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}

function FestivalFormModal({ festival, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(festival?.id);

  useEffect(() => {
    if (festival === undefined) return;
    setForm(
      festival
        ? {
            title: festival.title || "",
            start_date: festival.start_date || "",
            end_date: festival.end_date || "",
            description: festival.description || "",
            image_url: festival.image_url || "",
            highlight: Boolean(festival.highlight),
          }
        : EMPTY,
    );
  }, [festival]);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function handleSave() {
    if (!form.title.trim() || !form.start_date) {
      showError("Please enter the festival name and date.");
      return;
    }
    if (form.end_date && form.end_date < form.start_date) {
      showError("End date can't be before the start date.");
      return;
    }
    const payload = { ...form, title: form.title.trim(), end_date: form.end_date || null };
    setSaving(true);
    try {
      if (isEdit) await updateFestival(festival.id, payload);
      else await createFestival(payload);
      showSuccess(isEdit ? "Festival updated." : "Festival added.");
      onSaved();
      onClose();
    } catch (error) {
      showError(error?.data?.detail?.message || error?.message || "Could not save this festival.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={festival !== undefined} onClose={onClose} title={isEdit ? "Edit Festival" : "Add Festival"}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Festival Name *</span>
          <input value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="e.g. Holika Dahan" className={inputClass} />
          <span className="mt-1 block text-xs text-slate-400">Use the same name every year so linked pujas keep working.</span>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Date *</span>
          <input type="date" value={form.start_date} onChange={(e) => update("start_date", e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">End Date (multi-day only)</span>
          <input type="date" value={form.end_date} min={form.start_date || undefined} onChange={(e) => update("end_date", e.target.value)} className={inputClass} />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Description</span>
          <textarea value={form.description} onChange={(e) => update("description", e.target.value)} rows={2} className={inputClass} />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Image URL (optional)</span>
          <input value={form.image_url} onChange={(e) => update("image_url", e.target.value)} placeholder="/images/festivals/Diwali.png" className={inputClass} />
        </label>
        <label className="flex items-center gap-2 sm:col-span-2">
          <input type="checkbox" checked={form.highlight} onChange={(e) => update("highlight", e.target.checked)} className="h-4 w-4 rounded border-amber-300 text-maroon focus:ring-amber-200" />
          <span className="text-sm text-slate-600">Highlight on the home page</span>
        </label>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={onClose} disabled={saving} className="interactive-button rounded-full border border-amber-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-amber-50">
          Cancel
        </button>
        <button type="button" onClick={handleSave} disabled={saving} className="interactive-button rounded-full bg-maroon px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {saving ? "Saving..." : "Save Festival"}
        </button>
      </div>
    </Modal>
  );
}

export default function AdminFestivalsPage() {
  const [tab, setTab] = useState("upcoming");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formFestival, setFormFestival] = useState(undefined); // undefined = closed, null = add
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    listAdminFestivals(tab)
      .then((data) => setItems(data?.items || []))
      .catch(() => {
        setItems([]);
        showError("Could not load festivals.");
      })
      .finally(() => setLoading(false));
  }, [tab, refreshKey]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteFestival(deleteTarget.id);
      showSuccess("Festival deleted.");
      setDeleteTarget(null);
      setRefreshKey((k) => k + 1);
    } catch (error) {
      showError(error?.message || "Could not delete this festival.");
    } finally {
      setDeleting(false);
    }
  }

  const term = search.trim().toLowerCase();
  const visible = term ? items.filter((f) => (f.title || "").toLowerCase().includes(term)) : items;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-xl font-semibold text-maroon">Festivals</h1>
          <p className="text-sm text-slate-500">Festival calendar for the home page and festival-puja date checks.</p>
        </div>
        <button type="button" onClick={() => setFormFestival(null)} className="interactive-button rounded-full bg-maroon px-4 py-2 text-sm font-semibold text-white">
          + Add Festival
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-full border border-amber-100 bg-white p-1">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${tab === item.key ? "bg-maroon text-white" : "text-slate-600 hover:bg-amber-50"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search festivals" className={`${inputClass} rounded-full sm:w-64`} />
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading festivals...</p>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-amber-100 bg-white p-8 text-center text-sm text-slate-400">No festivals here yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-amber-100 bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-amber-50/60 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Festival</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Home page</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-50">
              {visible.map((festival) => (
                <tr key={festival.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-700">{festival.title}</p>
                    {festival.description && <p className="line-clamp-1 text-xs text-slate-400">{festival.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDate(festival.start_date)}
                    {festival.end_date && <span className="text-slate-400"> → {formatDate(festival.end_date)}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {festival.highlight ? (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Highlighted</span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => setFormFestival(festival)} className="mr-2 rounded-full border border-amber-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-amber-50">
                      Edit
                    </button>
                    <button type="button" onClick={() => setDeleteTarget(festival)} className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <FestivalFormModal festival={formFestival} onClose={() => setFormFestival(undefined)} onSaved={() => setRefreshKey((k) => k + 1)} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Festival"
        message={deleteTarget ? `Delete ${deleteTarget.title} (${formatDate(deleteTarget.start_date)})? Pujas linked to this festival keep their link and use the next date with the same name.` : ""}
        confirmLabel="Delete"
        confirmClassName="bg-rose-600 hover:bg-rose-700"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
