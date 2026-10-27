const STATUS_STYLES = {
  active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-slate-100 text-slate-600",
  scheduled: "bg-amber-100 text-amber-700",
};

function couponStatus(coupon) {
  if (!coupon.is_active) return "inactive";
  if (coupon.valid_from && new Date(coupon.valid_from) > new Date()) return "scheduled";
  return "active";
}

function formatDiscount(coupon) {
  return coupon.discount_type === "percentage" ? `${coupon.discount_value}% Off` : `₹${coupon.discount_value} Off`;
}

export default function CouponsTable({ coupons = [], onEdit, onDelete }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-amber-100 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-amber-100 text-xs uppercase text-slate-400">
          <tr>
            <th className="px-4 py-3 font-medium">Code</th>
            <th className="px-4 py-3 font-medium">Discount</th>
            <th className="px-4 py-3 font-medium">Valid Till</th>
            <th className="px-4 py-3 font-medium">Usage</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-amber-50">
          {coupons.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                No coupons found.
              </td>
            </tr>
          )}
          {coupons.map((coupon) => {
            const status = couponStatus(coupon);
            return (
              <tr key={coupon.id}>
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-700">{coupon.code}</div>
                  <div className="text-xs font-normal text-slate-400">{coupon.description}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">{formatDiscount(coupon)}</td>
                <td className="px-4 py-3 text-slate-500">
                  {coupon.valid_until ? new Date(coupon.valid_until).toLocaleDateString() : "No expiry"}
                </td>
                <td className="px-4 py-3 text-slate-600">{coupon.usage_count ?? 0}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[status]}`}>
                    {status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      aria-label={`Edit ${coupon.code}`}
                      onClick={() => onEdit(coupon)}
                      className="interactive-button rounded-lg border border-maroon/30 px-2.5 py-1.5 text-xs font-semibold text-maroon hover:bg-maroon/10"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${coupon.code}`}
                      onClick={() => onDelete(coupon)}
                      className="interactive-button rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
