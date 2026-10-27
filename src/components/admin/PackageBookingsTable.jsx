const STATUS_STYLES = {
  pending_review: "bg-amber-100 text-amber-700",
  quoted: "bg-sky-100 text-sky-700",
  paid_pending_assignment: "bg-emerald-100 text-emerald-700",
};

const STATUS_LABELS = {
  pending_review: "Pending Review",
  quoted: "Quoted",
  paid_pending_assignment: "Awaiting Pandit Assignment",
};

export default function PackageBookingsTable({ bookings = [], onView }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-amber-100 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-amber-100 text-xs uppercase text-slate-400">
          <tr>
            <th className="px-4 py-3 font-medium">Puja</th>
            <th className="px-4 py-3 font-medium">Yajmaan</th>
            <th className="px-4 py-3 font-medium">Requested Date</th>
            <th className="px-4 py-3 font-medium">Amount</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-amber-50">
          {bookings.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                No package puja requests found.
              </td>
            </tr>
          )}
          {bookings.map((booking) => (
            <tr key={booking.id}>
              <td className="px-4 py-3 font-medium text-slate-700">{booking.puja?.title || "-"}</td>
              <td className="px-4 py-3 text-slate-600">
                <div>{booking.customer?.full_name || "-"}</div>
                <div className="text-xs text-slate-400">{booking.customer?.phone}</div>
              </td>
              <td className="px-4 py-3 text-slate-500">
                {booking.booking_date} <span className="text-xs text-slate-400">{booking.muhurat_time_slot}</span>
              </td>
              <td className="px-4 py-3 text-slate-600">{booking.amount ? `Rs. ${Number(booking.amount).toFixed(2)}` : "Not quoted"}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[booking.status] || "bg-slate-100 text-slate-600"}`}>
                  {STATUS_LABELS[booking.status] || booking.status}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    aria-label={`View package request for ${booking.puja?.title}`}
                    onClick={() => onView(booking)}
                    className="interactive-button rounded-lg border border-amber-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-amber-50"
                  >
                    View
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
