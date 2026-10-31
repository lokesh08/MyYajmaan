import Modal from "../Modal";
import { t } from "../../i18n";

/**
 * Small reusable confirm modal for admin actions (approve, enable,
 * delete, ...). For actions that need a reason/note, pass `children`
 * (e.g. a textarea) to render below the message.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  confirmClassName = "bg-maroon hover:bg-maroon",
  loading = false,
  onConfirm,
  onClose,
  children,
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        {message && <p className="text-sm text-slate-600">{message}</p>}

        {children}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="interactive-button rounded-full border border-amber-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t("Cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`interactive-button rounded-full px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ${confirmClassName}`}
          >
            {loading ? t("Please wait...") : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
