import { useEffect, useState } from "react";

import { usePanditPortal } from "../../context/PanditPortalContext";
import { addMyPujas, listMyPujas, listPublicPujas, removeMyPuja, updateMyPuja } from "../../services/panditApi";
import { showError, showSuccess } from "../../utils/toaster";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import Modal from "../../components/Modal";
import LockedNotice from "../../components/pandit/LockedNotice";

function AddPujaModal({ open, onClose, onAdded, existingPujaIds }) {
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected({});
    setLoading(true);
    listPublicPujas(200)
      .then((data) => setCatalog(data || []))
      .catch(() => showError("Could not load the puja list."))
      .finally(() => setLoading(false));
  }, [open]);

  const available = catalog.filter((puja) => !existingPujaIds.has(puja.id));

  function togglePuja(pujaId) {
    setSelected((current) => {
      const next = { ...current };
      if (pujaId in next) delete next[pujaId];
      else next[pujaId] = "";
      return next;
    });
  }

  function updateFee(pujaId, value) {
    setSelected((current) => ({ ...current, [pujaId]: value }));
  }

  async function handleSave() {
    const entries = Object.entries(selected);
    if (entries.length === 0) {
      showError("Please select at least one puja.");
      return;
    }
    for (const [, fee] of entries) {
      if (!fee || Number(fee) <= 0) {
        showError("Please enter a fee for every selected puja.");
        return;
      }
    }
    setSaving(true);
    try {
      await addMyPujas(entries.map(([pujaId, fee]) => ({ puja_id: pujaId, price_override: Number(fee) })));
      showSuccess("Puja(s) added successfully.");
      onAdded();
      onClose();
    } catch (error) {
      showError(error?.message || "Could not add these pujas.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Puja" size="lg">
      {loading ? (
        <p className="py-6 text-center text-sm text-slate-400">Loading pujas...</p>
      ) : available.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">You've already added every available puja.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {available.map((puja) => {
            const isChecked = puja.id in selected;
            return (
              <div key={puja.id} className={`rounded-xl border p-3 transition ${isChecked ? "border-maroon bg-amber-50/60" : "border-amber-200 bg-white"}`}>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => togglePuja(puja.id)}
                    className="mt-0.5 h-4 w-4 rounded border-amber-300 text-maroon focus:ring-amber-200"
                  />
                  <span className="text-sm font-medium text-slate-700">{puja.title}</span>
                </label>
                {isChecked && (
                  <div className="mt-2 pl-6">
                    <input
                      type="number"
                      min="1"
                      value={selected[puja.id]}
                      onChange={(event) => updateFee(puja.id, event.target.value)}
                      placeholder="Your fee (Rs.) *"
                      className="w-full rounded-lg border border-amber-200 px-2.5 py-1.5 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={onClose} disabled={saving} className="interactive-button rounded-full border border-amber-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-amber-50">
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || available.length === 0}
          className="interactive-button rounded-full bg-maroon px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Add Selected"}
        </button>
      </div>
    </Modal>
  );
}

export default function PanditMyPujasPage() {
  const { stage, rejectionReason } = usePanditPortal();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingFee, setEditingFee] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);

  function load() {
    setLoading(true);
    listMyPujas()
      .then((data) => setItems(data?.items || []))
      .catch(() => showError("Could not load your pujas."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (stage === "approved") load();
  }, [stage]);

  if (stage !== "approved") {
    return <LockedNotice stage={stage} rejectionReason={rejectionReason} />;
  }

  function startEdit(row) {
    setEditingId(row.id);
    setEditingFee(String(row.price_override ?? ""));
  }

  async function saveEdit(row) {
    const fee = Number(editingFee);
    if (!editingFee || fee <= 0) {
      showError("Please enter a valid fee.");
      return;
    }
    setSavingId(row.id);
    try {
      await updateMyPuja(row.id, { price_override: fee });
      showSuccess("Fee updated successfully.");
      setEditingId(null);
      load();
    } catch (error) {
      showError(error?.message || "Could not update this fee.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleRemoveConfirm() {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await removeMyPuja(removeTarget.id);
      showSuccess("Puja removed from your services.");
      setRemoveTarget(null);
      load();
    } catch (error) {
      showError(error?.message || "Could not remove this puja.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl font-semibold text-maroon">My Pujas</h1>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="interactive-button rounded-full bg-maroon px-5 py-2.5 text-sm font-semibold text-white hover:bg-maroon"
        >
          + Add Puja
        </button>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading...</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-amber-100 bg-white p-8 text-center text-sm text-slate-400">
          You haven't added any pujas yet. Click "Add Puja" to get started.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-amber-100 bg-white shadow-sm">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="bg-amber-50/60 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Puja</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Fee</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-50">
              {items.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-medium text-slate-700">{row.puja?.title || "Puja"}</td>
                  <td className="px-4 py-3 text-slate-500">{row.puja?.duration_minutes ? `${row.puja.duration_minutes} min` : "—"}</td>
                  <td className="px-4 py-3">
                    {editingId === row.id ? (
                      <input
                        type="number"
                        min="1"
                        value={editingFee}
                        onChange={(e) => setEditingFee(e.target.value)}
                        className="w-28 rounded-lg border border-amber-200 px-2.5 py-1.5 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
                      />
                    ) : (
                      <span className="font-semibold text-maroon">Rs. {Number(row.price_override || 0).toFixed(2)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                      {row.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editingId === row.id ? (
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="interactive-button rounded-full border border-amber-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-amber-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={savingId === row.id}
                          onClick={() => saveEdit(row)}
                          className="interactive-button rounded-full bg-maroon px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          {savingId === row.id ? "Saving..." : "Save"}
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          className="interactive-button rounded-full border border-amber-200 px-3 py-1.5 text-xs font-semibold text-maroon hover:bg-amber-50"
                        >
                          Edit Fee
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemoveTarget(row)}
                          className="interactive-button rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddPujaModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={load}
        existingPujaIds={new Set(items.map((row) => row.puja_id))}
      />

      <ConfirmDialog
        open={Boolean(removeTarget)}
        title="Remove Puja"
        message={`Remove "${removeTarget?.puja?.title || "this puja"}" from your service list?`}
        confirmLabel="Remove"
        confirmClassName="bg-rose-600 hover:bg-rose-700"
        loading={removing}
        onConfirm={handleRemoveConfirm}
        onClose={() => setRemoveTarget(null)}
      />
    </div>
  );
}
