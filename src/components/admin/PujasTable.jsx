import { showError } from "../../utils/toaster";
import { setPujaStatus } from "../../services/adminApi";

const LISTING_STYLES = {
  normal: "bg-slate-100 text-slate-600",
  trending: "bg-amber-100 text-amber-700",
  featured: "bg-emerald-100 text-emerald-700",
};

export default function PujasTable({ pujas = [], onView, onEdit, onDelete, onStatusChanged }) {
  async function handleToggle(puja) {
    const nextActive = !puja.is_active;
    try {
      await setPujaStatus(puja.id, nextActive);
      onStatusChanged?.(puja.id, nextActive);
    } catch (error) {
      showError(error?.data?.detail?.message || error?.message || "Could not update puja status.");
    }
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-amber-100 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-amber-100 text-xs uppercase text-slate-400">
          <tr>
            <th className="px-4 py-3 font-medium">Puja</th>
            <th className="px-4 py-3 font-medium">Category</th>
            <th className="px-4 py-3 font-medium">Price</th>
            <th className="px-4 py-3 font-medium">Listing</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-amber-50">
          {pujas.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                No pujas found.
              </td>
            </tr>
          )}
          {pujas.map((puja) => (
            <tr key={puja.id}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  {puja.thumbnail_url ? (
                    <img
                      src={puja.thumbnail_url}
                      alt={puja.title}
                      className="h-10 w-10 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-xs text-slate-400">
                      No img
                    </div>
                  )}
                  <span className="font-medium text-slate-700">{puja.title}</span>
                </div>
              </td>
              <td className="px-4 py-3 capitalize text-slate-600">{puja.category || "-"}</td>
              <td className="px-4 py-3 text-slate-600">
                {puja.base_price ? `₹${puja.base_price}` : "-"}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                    LISTING_STYLES[puja.listing_type] || LISTING_STYLES.normal
                  }`}
                >
                  {puja.listing_type || "normal"}
                </span>
              </td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={puja.is_active}
                  aria-label={`Toggle ${puja.title} active state`}
                  onClick={() => handleToggle(puja)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                    puja.is_active ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      puja.is_active ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    aria-label={`View ${puja.title}`}
                    onClick={() => onView(puja)}
                    className="interactive-button rounded-lg border border-amber-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-amber-50"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    aria-label={`Edit ${puja.title}`}
                    onClick={() => onEdit(puja)}
                    className="interactive-button rounded-lg border border-maroon/30 px-2.5 py-1.5 text-xs font-semibold text-maroon hover:bg-maroon/10"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${puja.title}`}
                    onClick={() => onDelete(puja)}
                    className="interactive-button rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
