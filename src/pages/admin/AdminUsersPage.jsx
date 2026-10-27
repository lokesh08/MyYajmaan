import { useEffect, useState } from "react";

import { getUserStatusCounts, getUsersExportUrl, listUsers } from "../../services/adminApi";
import UsersTable from "../../components/admin/UsersTable";
import UserViewModal from "../../components/admin/UserViewModal";
import UserEditModal from "../../components/admin/UserEditModal";

const TABS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
  { key: "blocked", label: "Blocked" },
];

const PAGE_SIZE = 10;

export default function AdminUsersPage() {
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ all: 0, active: 0, inactive: 0, blocked: 0 });
  const [loading, setLoading] = useState(false);
  const [viewUserId, setViewUserId] = useState(null);
  const [editUser, setEditUser] = useState(null);
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
    listUsers({ status: tab, search: debouncedSearch, page, pageSize: PAGE_SIZE })
      .then((data) => {
        setUsers(data?.items || []);
        setTotal(data?.total || 0);
      })
      .catch(() => {
        setUsers([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [tab, debouncedSearch, page, refreshKey]);

  useEffect(() => {
    getUserStatusCounts(debouncedSearch).then(setCounts).catch(() => {});
  }, [debouncedSearch, refreshKey]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function handleUpdated() {
    setRefreshKey((key) => key + 1);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 rounded-full border border-amber-100 bg-white p-1">
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

        <div className="flex gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email or phone"
            className="w-64 rounded-full border border-amber-200 px-4 py-2 text-sm outline-none focus:border-maroon focus:ring-2 focus:ring-amber-100"
          />
          <a
            href={getUsersExportUrl({ status: tab, search: debouncedSearch })}
            className="interactive-button rounded-full border border-amber-200 px-4 py-2 text-sm font-semibold text-maroon hover:bg-amber-50"
          >
            Export
          </a>
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading users...</p>
      ) : (
        <UsersTable users={users} onView={(user) => setViewUserId(user.id)} onEdit={(user) => setEditUser(user)} />
      )}

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          Showing {users.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}
          {" - "}
          {Math.min(page * PAGE_SIZE, total)} of {total} users
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

      <UserViewModal userId={viewUserId} open={Boolean(viewUserId)} onClose={() => setViewUserId(null)} />
      <UserEditModal user={editUser} open={Boolean(editUser)} onClose={() => setEditUser(null)} onUpdated={handleUpdated} />
    </div>
  );
}
