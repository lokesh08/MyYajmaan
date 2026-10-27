const STATUS_STYLES = {
  new: "bg-amber-100 text-amber-700",
  in_progress: "bg-sky-100 text-sky-700",
  resolved: "bg-emerald-100 text-emerald-700",
};

const STATUS_LABELS = {
  new: "New",
  in_progress: "In Progress",
  resolved: "Resolved",
};

export default function SupportTable({ requests = [], onView }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-amber-100 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-amber-100 text-xs uppercase text-slate-400">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Contact</th>
            <th className="px-4 py-3 font-medium">Message</th>
            <th className="px-4 py-3 font-medium">Submitted</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-amber-50">
          {requests.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                No support requests found.
              </td>
            </tr>
          )}
          {requests.map((request) => (
            <tr key={request.id}>
              <td className="px-4 py-3 font-medium text-slate-700">
                {request.first_name} {request.last_name}
              </td>
              <td className="px-4 py-3 text-slate-600">
                <div>{request.email}</div>
                <div className="text-xs text-slate-400">{request.phone}</div>
              </td>
              <td className="max-w-xs px-4 py-3 text-slate-600">
                <p className="truncate">{request.message}</p>
              </td>
              <td className="px-4 py-3 text-slate-500">
                {request.created_at ? new Date(request.created_at).toLocaleDateString() : "-"}
              </td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[request.status] || "bg-slate-100 text-slate-600"}`}>
                  {STATUS_LABELS[request.status] || request.status}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    aria-label={`View request from ${request.first_name}`}
                    onClick={() => onView(request)}
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
