import Modal from "../Modal";
import { describeAction, describeEntity, describePayload, getCategoryStyle } from "../../utils/auditFormatting";
import { formatRoleLabel } from "../../utils/roleLabels";

export default function AuditDetailModal({ event, open, onClose }) {
  if (!event) {
    return <Modal open={open} onClose={onClose} title="Audit Event Details" size="md" />;
  }

  const { label, category } = describeAction(event.action);
  const style = getCategoryStyle(category);
  const entityLabel = describeEntity(event.entity);
  const actorName = event.actor?.full_name || event.actor?.email || (event.actor_id ? null : "System / Anonymous");

  return (
    <Modal open={open} onClose={onClose} title="Audit Event Details" size="md">
      <div className="space-y-4 text-sm">
        <div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg ${style.badge}`}>
            {style.icon}
          </span>
          <div>
            <p className="font-serif text-lg font-semibold text-maroon">{label}</p>
            <p className="mt-1 text-slate-600">{describePayload(event.action, event.payload)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-slate-400">When</p>
            <p className="font-medium text-slate-700">
              {event.created_at ? new Date(event.created_at).toLocaleString() : "-"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Section</p>
            <p className="font-medium text-slate-700">{entityLabel || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Performed By</p>
            <p className="font-medium text-slate-700">{actorName || "Unknown user"}</p>
            {event.actor?.role && <p className="text-xs text-slate-400">{formatRoleLabel(event.actor.role)}</p>}
          </div>
          <div>
            <p className="text-xs text-slate-400">Record ID</p>
            <p className="truncate font-mono text-xs text-slate-500">{event.entity_id || "-"}</p>
          </div>
        </div>

        <details className="rounded-xl border border-amber-100">
          <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-maroon">
            Technical details (raw event)
          </summary>
          <div className="space-y-2 border-t border-amber-100 px-3 py-3">
            <p className="text-xs text-slate-400">
              Action code: <span className="font-mono text-slate-600">{event.action}</span>
            </p>
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-900 px-3 py-3 text-xs text-emerald-200">
              {JSON.stringify(event.payload ?? {}, null, 2)}
            </pre>
          </div>
        </details>
      </div>
    </Modal>
  );
}
