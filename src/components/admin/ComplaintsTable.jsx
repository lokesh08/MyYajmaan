const STATUS_STYLES = {
  open: "bg-amber-100 text-amber-700",
  in_progress: "bg-sky-100 text-sky-700",
  resolved: "bg-emerald-100 text-emerald-700",
};

const STATUS_LABELS = {
  open: "Not Viewed",
  in_progress: "In Progress",
  resolved: "Completed",
};

export default function ComplaintsTable({ complaints = [], onView }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-amber-100 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-amber-100 text-xs uppercase text-slate-400">
          <tr>
            <th className="px-4 py-3 font-medium">Subject</th>
            <th className="px-4 py-3 font-medium">Yajmaan</th>
            <th className="px-4 py-3 font-medium">Booking</th>
            <th className="px-4 py-3 font-medium">Raised</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-amber-50">
          {complaints.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                No complaints found.
              </td>
            </tr>
          )}
          {complaints.map((complaint) => (
            <tr key={complaint.id}>
              <td className="max-w-xs px-4 py-3 text-slate-700">
                <p className="truncate font-medium">{complaint.subject}</p>
              </td>
              <td className="px-4 py-3 text-slate-600">
                <div>{complaint.user?.full_name || "-"}</div>
                <div className="text-xs text-slate-400">{complaint.user?.email}</div>
              </td>
              <td className="px-4 py-3 text-slate-500">
                {complaint.booking?.booking_date || "-"}
                {complaint.booking?.amount ? <div className="text-xs text-slate-400">Rs. {Number(complaint.booking.amount).toFixed(2)}</div> : null}
              </td>
              <td className="px-4 py-3 text-slate-500">
                {complaint.created_at ? new Date(complaint.created_at).toLocaleDateString() : "-"}
              </td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[complaint.status] || "bg-slate-100 text-slate-600"}`}>
                  {STATUS_LABELS[complaint.status] || complaint.status}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    aria-label={`View complaint ${complaint.subject}`}
                    onClick={() => onView(complaint)}
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
