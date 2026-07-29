export default function ThemeDialog({ open, title, message, onClose, confirmLabel = 'OK' }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[1.75rem] border border-amber-100 bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-xl text-maroon">✦</div>
          <div className="flex-1">
            <h3 className="font-serif text-2xl font-semibold text-maroon">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="rounded-full bg-maroon px-5 py-2 font-semibold text-white">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
