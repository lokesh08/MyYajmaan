import { useEffect, useState } from 'react';
import Modal from './Modal';
import './modals.css';

function formatDateTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatCountdown(ms) {
  if (ms == null || ms <= 0) return null;
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function formatPujaDiscount(row) {
  const amount = row.discount_type === 'flat' ? `₹${row.discount_value}` : `${row.discount_value}%`;
  return { title: row.puja_title || 'Selected puja', amount };
}

export default function MuhratModal({ open, onClose, muhrat }) {
  // muhrat: { active, start_at, end_at, discount_percent, puja_discounts, title, description }
  const m = muhrat || {};
  const active = !!m.active;
  const title = m.title || 'Shubh Muhurat';
  const pujaDiscounts = m.puja_discounts || [];
  const hasFlatDiscount = m.discount_percent != null;
  const discountLabel = hasFlatDiscount ? `${m.discount_percent}%` : pujaDiscounts.length > 0 ? 'Special' : '—';
  const shareUrl = m.shareUrl || window.location.origin;
  const startAt = m.startAt || m.start_at;
  const endAt = m.endAt || m.end_at;
  const shareText = m.title
    ? `${m.title} on ${startAt ? formatDateTime(startAt) : ''} — Discount ${discountLabel} at MyYajmaan: ${shareUrl}`
    : `Shubh Muhurat at MyYajmaan: ${shareUrl}`;

  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(null);

  useEffect(() => {
    if (!open || !active || !endAt) {
      setCountdown(null);
      return undefined;
    }
    const endTime = new Date(endAt).getTime();
    function tick() {
      setCountdown(formatCountdown(endTime - Date.now()));
    }
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [open, active, endAt]);

  const onNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: shareText, url: shareUrl });
        if (window.sendAnalytics) window.sendAnalytics('muhrat_share', { title });
      } catch (e) { /* ignore share cancellation/errors */ }
    } else {
      onCopyLink();
    }
  };

  const onCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      if (window.sendAnalytics) window.sendAnalytics('muhrat_copy_link', { title });
    } catch {
      window.prompt('Copy link', shareUrl);
    }
  };

  function handleBookClick() {
    if (window.sendAnalytics) window.sendAnalytics('muhrat_book_click', { title });
    onClose();
    // If you want to navigate automatically, implement router push here.
  }

  const bookLabel = !active
    ? 'No Shubh Muhurat Active Right Now'
    : hasFlatDiscount
      ? `Book Now & Save ${discountLabel}`
      : pujaDiscounts.length > 0
        ? 'View Puja Offers & Book'
        : 'Book Now';

  return (
    <Modal open={open} onClose={onClose} title={title} size="md" headerClassName="modal-header-themed">
      <div className="space-y-4">
        <div className="-mx-[18px] -mt-4 mb-1 flex items-center gap-3 bg-gradient-to-br from-maroon-deeper via-maroon to-maroon-light px-[18px] pb-5 pt-4 text-white">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-2xl">
            🪔
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-100">
              {active ? 'Live Now' : 'Upcoming Offer'}
            </p>
            <p className="truncate text-sm text-amber-50/90">
              Auspicious puja bookings, blessed with a special discount.
            </p>
          </div>
        </div>

        {active && countdown && (
          <div className="-mt-3 flex items-center gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-parchment-200 to-parchment-300 px-4 py-3">
            <span className="text-xl">⏳</span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-maroon/70">Offer ends in</p>
              <p className="font-mono text-xl font-bold tracking-wider text-maroon">{countdown}</p>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-amber-200 bg-cream p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">📅 Date &amp; Time</p>
            <p className="mt-1.5 font-semibold text-maroon">{startAt ? formatDateTime(startAt) : 'To be announced'}</p>
            {endAt && <p className="mt-0.5 text-xs text-slate-500">Until {formatDateTime(endAt)}</p>}
          </div>

          <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-parchment-200 to-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">🎁 Discount</p>
            <p className="mt-1.5 font-serif text-3xl font-bold text-saffron">{discountLabel}</p>
          </div>
        </div>

        <div className="rounded-2xl bg-amber-50/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Details</p>
          <p className="mt-1.5 leading-6 text-slate-700">
            {m.description || 'Special discounted puja bookings during the shubh muhrat. Admin will set the schedule.'}
          </p>
        </div>

        {pujaDiscounts.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">✨ Puja-wise Offers</p>
            <div className="grid gap-2">
              {pujaDiscounts.map((row, index) => {
                const { title: pujaTitle, amount } = formatPujaDiscount(row);
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-xl border border-amber-100 bg-white px-4 py-2.5 shadow-sm transition hover:border-saffron/40 hover:shadow-md"
                  >
                    <span className="font-medium text-slate-700">{pujaTitle}</span>
                    <span className="rounded-full bg-gradient-to-r from-saffron to-sand px-3 py-1 text-xs font-bold text-maroon">
                      {amount} OFF
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleBookClick}
            disabled={!active}
            className="interactive-button flex-1 rounded-full bg-gradient-to-r from-maroon to-maroon px-5 py-3 text-sm font-semibold text-white shadow-button disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-500 disabled:shadow-none"
          >
            {bookLabel}
          </button>

          <button
            type="button"
            onClick={onNativeShare}
            aria-label="Share this Shubh Muhurat"
            title="Share"
            className="interactive-button flex shrink-0 items-center gap-1.5 rounded-full border border-amber-200 px-4 py-3 text-sm font-semibold text-maroon hover:bg-amber-50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7a3.7 3.7 0 000-1.4l7.02-4.11A2.99 2.99 0 1014 5c0 .12.01.24.03.36L7.03 9.47A3 3 0 107 15a3 3 0 00.97-1.79l7.05 4.12c-.02.12-.02.24-.02.36a2.99 2.99 0 103 3z" />
            </svg>
            {copied ? 'Copied' : 'Share'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
