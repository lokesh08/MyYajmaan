export default function ThemeNotice({ type = 'info', title, message }) {
  const styles = {
    info: 'border-amber-200 bg-amber-50 text-slate-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    error: 'border-rose-200 bg-rose-50 text-rose-900',
  };

  const icon = {
    info: '✦',
    success: '✓',
    error: '!',
  }[type];

  return (
    <div className={`mt-4 rounded-2xl border p-4 ${styles[type]}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-sm font-semibold">{icon}</div>
        <div>
          {title && <p className="font-semibold">{title}</p>}
          {message && <p className="mt-1 text-sm leading-6">{message}</p>}
        </div>
      </div>
    </div>
  );
}
