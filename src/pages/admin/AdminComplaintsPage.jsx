import { useEffect, useState } from "react";

import { getComplaintStatusCounts, listComplaints } from "../../services/adminApi";
import ComplaintsTable from "../../components/admin/ComplaintsTable";
import ComplaintDetailModal from "../../components/admin/ComplaintDetailModal";

const TABS = [
  { key: "all", label: "All" },
  { key: "open", label: "Not Viewed" },
  { key: "in_progress", label: "In Progress" },
  { key: "resolved", label: "Completed" },
];

const PAGE_SIZE = 10;

export default function AdminComplaintsPage() {
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [complaints, setComplaints] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ all: 0, open: 0, in_progress: 0, resolved: 0 });
  const [loading, setLoading] = useState(false);
  const [viewComplaintId, setViewComplaintId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [tab, debouncedSearch]);

  useEffect(() => {
    setLoading(true);
    listComplaints({ status: tab, search: debouncedSearch, page, pageSize: PAGE_SIZE })
      .then((data) => {
        setComplaints(data?.items || []);
        setTotal(data?.total || 0);
      })
      .catch(() => {
        setComplaints([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [tab, debouncedSearch, page, refreshKey]);

  useEffect(() => {
    getComplaintStatusCounts(debouncedSearch).then(setCounts).catch(() => {});
  }, [debouncedSearch, refreshKey]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function handleChanged() {
    setRefreshKey((key) => key + 1);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-maroon">Complaints</h1>
        <p className="text-sm text-slate-500">Post-puja disputes raised by Yajmaans, for review and resolution.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 rounded-full border border-amber-100 bg-white p-1">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                tab === item.key ? "bg-maroon text-white" : "text-slate-600 hover:bg-amber-50"
              }`}
            >
              {item.label} ({counts[item.key] ?? 0})
            </button>
          ))}
        </div>

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by subject"
          className="w-full rounded-full border border-amber-200 px-4 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100 sm:w-72"
        />
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading complaints...</p>
      ) : (
        <ComplaintsTable complaints={complaints} onView={(complaint) => setViewComplaintId(complaint.id)} />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
        <span>
          Showing {complaints.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}
          {" - "}
          {Math.min(page * PAGE_SIZE, total)} of {total} complaints
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="interactive-button rounded-lg border border-amber-200 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-2 py-1.5">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            className="interactive-button rounded-lg border border-amber-200 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      <ComplaintDetailModal
        complaintId={viewComplaintId}
        open={Boolean(viewComplaintId)}
        onClose={() => setViewComplaintId(null)}
        onChanged={handleChanged}
      />
    </div>
  );
}
