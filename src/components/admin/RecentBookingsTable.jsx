const STATUS_STYLES = {
  confirmed: "bg-sky-100 text-sky-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-100 text-rose-700",
  pending: "bg-amber-100 text-amber-700",
};

export default function RecentBookingsTable({ bookings = [] }) {
  return (
    <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
      <p className="mb-3 text-sm font-semibold text-maroon">Recent Bookings</p>

      {bookings.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">No bookings yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400">
                <th className="pb-2 font-medium">User</th>
                <th className="pb-2 font-medium">Pandit Ji</th>
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Amount</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-50">
              {bookings.map((booking) => (
                <tr key={booking.id}>
                  <td className="py-2 font-medium text-slate-700">{booking.client_name || "N/A"}</td>
                  <td className="py-2 text-slate-600">{booking.pandit_name || "N/A"}</td>
                  <td className="py-2 text-slate-500">{booking.date_display || "-"}</td>
                  <td className="py-2 text-slate-700">₹{booking.amount ?? 0}</td>
                  <td className="py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${STATUS_STYLES[booking.status] || "bg-slate-100 text-slate-600"}`}>
                      {booking.status || "unknown"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
