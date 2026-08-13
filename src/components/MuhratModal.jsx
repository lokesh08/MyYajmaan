import React, { useState } from 'react';
import Modal from './Modal';
import './modals.css';

function formatDateTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleString();
}

export default function MuhratModal({ open, onClose, muhrat }) {
  // muhrat: { active, startAt, endAt, discountPercent, title, description, shareUrl }
  const m = muhrat || {};
  const active = !!m.active;
  const title = m.title || 'Shubh Muhurat';
  const discount = m.discountPercent ? `${m.discountPercent}%` : '—';
  const shareUrl = m.shareUrl || window.location.origin;
  const shareText = m.title ? `${m.title} on ${m.startAt ? formatDateTime(m.startAt) : ''} — Discount ${discount} at MyYajmaan: ${shareUrl}` : `Shubh Muhurat at MyYajmaan: ${shareUrl}`;

  const [copied, setCopied] = useState(false);

  const onNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: title, text: shareText, url: shareUrl });
        if (window.sendAnalytics) window.sendAnalytics('muhrat_share', { title });
      } catch (e) { /* ignore */ }
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

  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      <div className={`muhrat-box ${active ? 'active' : 'inactive'}`}>
        <div className="muhrat-row">
          <div className="muhrat-section">
            <div className="muhrat-label">Date & Time</div>
            <div className="muhrat-value">{m.startAt ? formatDateTime(m.startAt) : 'To be announced'}</div>
            {m.endAt && <div className="muhrat-sub">Until: {formatDateTime(m.endAt)}</div>}
          </div>

          <div className="muhrat-section">
            <div className="muhrat-label">Discount</div>
            <div className="muhrat-value">{discount}</div>
          </div>
        </div>

        <div className="muhrat-section desc">
          <div className="muhrat-label">Details</div>
          <div className="muhrat-desc">{m.description || 'Special discounted puja bookings during the shubh muhrat. Admin will set the schedule.'}</div>
        </div>

        <div className="muhrat-actions">
          <button
            className="btn-primary"
            onClick={() => {
              // Example: navigate to booking page or apply discount code
              if (window.sendAnalytics) window.sendAnalytics('muhrat_book_click', { title });
              onClose();
              // If you want to navigate automatically, implement router push here
            }}
            disabled={!active}
          >
            {active ? `Book with ${discount} OFF` : 'No shubh muhrat active'}
          </button>

          {/* small share icon button */}
          <button
            className="muhrat-share-btn"
            onClick={onNativeShare}
            aria-label="Share muhrat"
            title="Share"
            type="button"
          >
            {/* small share icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7a3.7 3.7 0 000-1.4l7.02-4.11A2.99 2.99 0 1014 5c0 .12.01.24.03.36L7.03 9.47A3 3 0 107 15a3 3 0 00.97-1.79l7.05 4.12c-.02.12-.02.24-.02.36a2.99 2.99 0 103 3z"/>
            </svg>
            <span className="muhrat-share-label">{copied ? 'Copied' : 'Share'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}