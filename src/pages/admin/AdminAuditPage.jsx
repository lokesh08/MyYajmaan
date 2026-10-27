import { useEffect, useState } from "react";

import { listAuditEvents } from "../../services/adminApi";
import AuditDetailModal from "../../components/admin/AuditDetailModal";
import {
  describeAction,
  describeEntity,
  describePayload,
  formatRelativeTime,
  getCategoryStyle,
  getKnownActions,
  getKnownEntities,
} from "../../utils/auditFormatting";

const PAGE_SIZE = 25;
const KNOWN_ACTIONS = getKnownActions();
const KNOWN_ENTITIES = getKnownEntities();

export default function AdminAuditPage() {
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [events, setEvents] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    setPage(1);
  }, [action, entity, dateFrom, dateTo]);

  useEffect(() => {
    setLoading(true);
    listAuditEvents({ action, entity, dateFrom, dateTo, page, pageSize: PAGE_SIZE })
      .then((data) => {
        setEvents(data?.items || []);
        setTotal(data?.total || 0);
      })
      .catch(() => {
        setEvents([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [action, entity, dateFrom, dateTo, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = action || entity || dateFrom || dateTo;

  function clearFilters() {
    setAction("");
    setEntity("");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-xl font-semibold text-maroon">Audit Log</h1>
        <p className="text-sm text-slate-500">
          Every recorded action across the app — logins, admin changes, and account activity — newest first.
        </p>
      </div>

      <div className="grid gap-3 rounded-2xl border border-amber-100 bg-white p-4 shadow-sm sm:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Action</span>
          <select
            value={action}
            onChange={(event) => setAction(event.target.value)}
            className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm outline-none"
          >
            <option value="">All actions</option>
            {KNOWN_ACTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Section</span>
          <select
            value={entity}
            onChange={(event) => setEntity(event.target.value)}
            className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm outline-none"
          >
            <option value="">All sections</option>
            {KNOWN_ENTITIES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">To</span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm outline-none"
          />
        </label>
      </div>

      {hasFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="interactive-button text-sm font-semibold text-saffron hover:text-maroon"
        >
          Clear filters
        </button>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading audit events...</p>
      ) : (
        <div className="divide-y divide-amber-50 overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm">
          {events.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-slate-400">No audit events found for these filters.</p>
          )}

          {events.map((event) => {
            const { label, category } = describeAction(event.action);
            const style = getCategoryStyle(category);
            const entityLabel = describeEntity(event.entity);
            const actorName = event.actor?.full_name || event.actor?.email || (event.actor_id ? "Unknown user" : "System");

            return (
              <button
                key={event.id}
                type="button"
                onClick={() => setSelectedEvent(event)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-amber-50/60"
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base ${style.badge}`}>
                  {style.icon}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-800">{label}</p>
                    {entityLabel && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                        {entityLabel}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-sm text-slate-500">{describePayload(event.action, event.payload)}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {actorName} · {formatRelativeTime(event.created_at)}
                  </p>
                </div>

                <span className="shrink-0 self-center text-xs font-semibold text-saffron">Details</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
        <span>
          Showing {events.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}
          {" - "}
          {Math.min(page * PAGE_SIZE, total)} of {total} events
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

      <AuditDetailModal event={selectedEvent} open={Boolean(selectedEvent)} onClose={() => setSelectedEvent(null)} />
    </div>
  );
}
