import React, { useState } from 'react';
import Modal from './Modal';
import './modals.css';

export default function ReferEarnModal({ open, onClose, data }) {
  // data: { code, signupReward, bookingReward, earnings, totalEarned, shareUrl }
  const d = data || {};
  const code = d.code || 'SHUBHALABHA25';
  const signupReward = d.signupReward ?? '₹25';
  const bookingReward = d.bookingReward ?? '₹51';
  const earnings = d.earnings ?? '₹76.00';
  const totalEarned = d.totalEarned ?? '₹936.00';
  const shareUrl = d.shareUrl || window.location.origin;

  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      // analytics hook: optional
      if (window.sendAnalytics) window.sendAnalytics('referral_copy', { code });
    } catch {
      window.prompt('Copy referral code', code);
    }
  };

  const shareText = `Use my referral code ${code} and get rewards on MyYajmaan! ${shareUrl}`;

  const shareWhatsApp = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const shareFB = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`;
  const shareEmail = `mailto:?subject=${encodeURIComponent('Join MyYajmaan')}&body=${encodeURIComponent(shareText)}`;

  const onNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join MyYajmaan', text: shareText, url: shareUrl });
        if (window.sendAnalytics) window.sendAnalytics('referral_native_share', { code });
      } catch (e) { /* ignore share cancellation/errors */ }
    } else {
      onCopy();
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Refer & Earn" size="lg">
      <div className="refer-grid">
        <div className="reward-card">
          <div className="reward-amount">{signupReward}</div>
          <div className="reward-sub">You earn when your friend signs up</div>
        </div>
        <div className="reward-card">
          <div className="reward-amount">{bookingReward}</div>
          <div className="reward-sub">You earn when your friend completes first puja booking</div>
        </div>
      </div>

      <div className="referral-row">
        <div className="ref-label">Your Referral Code</div>
        <div className="ref-code">{code}</div>
        <button className="btn-copy" onClick={onCopy}>{copied ? 'Copied' : 'Copy'}</button>
      </div>

      <div className="share-row">
        <div className="share-title">Share your code</div>
        <div className="share-buttons">
          <a
            className="share-btn icon whatsapp"
            href={shareWhatsApp}
            target="_blank"
            rel="noreferrer"
            aria-label="Share via WhatsApp"
            title="WhatsApp"
          >
            {/* WhatsApp SVG */}
            <svg className="icon-svg" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M20.52 3.48A11.86 11.86 0 0012.03.5C6.42.5 1.9 5.02 1.9 10.63c0 1.88.49 3.72 1.43 5.35L.5 23.5l7.7-2.02c1.55.43 3.18.66 4.83.66 5.61 0 10.13-4.52 10.13-10.13 0-2.71-1.06-5.25-2.67-7.51zM12.03 21.1c-1.44 0-2.86-.39-4.09-1.12l-.29-.17-4.58 1.2 1.24-3.89-.19-.31A8.76 8.76 0 013 10.63c0-4.36 3.54-7.9 7.9-7.9 2.11 0 4.09.82 5.58 2.31 1.48 1.48 2.3 3.45 2.3 5.56 0 4.36-3.54 7.9-7.9 7.9z"/>
              <path d="M17.05 14.1c-.29-.14-1.72-.85-1.98-.95-.27-.11-.48-.16-.68.16s-.78.95-.96 1.15c-.17.19-.34.21-.63.07-.29-.14-1.22-.45-2.32-1.44-.86-.76-1.44-1.7-1.61-1.99-.17-.29-.02-.45.12-.59.12-.12.29-.34.44-.51.15-.17.2-.29.3-.48.1-.19.05-.36-.02-.51-.07-.14-.68-1.64-.93-2.24-.24-.59-.49-.51-.68-.52l-.58-.01c-.2 0-.52.07-.79.36-.27.29-1.03 1.01-1.03 2.46 0 1.44 1.06 2.83 1.21 3.03.16.2 2.09 3.21 5.06 4.5 2.97 1.28 3.18 1.08 3.76 1.01.58-.07 1.72-.7 1.97-1.38.25-.68.25-1.26.18-1.38-.07-.12-.26-.19-.55-.33z"/>
            </svg>
          </a>

          <a
            className="share-btn icon facebook"
            href={shareFB}
            target="_blank"
            rel="noreferrer"
            aria-label="Share on Facebook"
            title="Facebook"
          >
            {/* Facebook SVG */}
            <svg className="icon-svg" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M22 12.07C22 6.48 17.52 2 11.93 2S2 6.48 2 12.07c0 4.99 3.66 9.12 8.44 9.93v-7.03H8.9v-2.9h1.54V9.41c0-1.52.9-2.36 2.28-2.36.66 0 1.35.12 1.35.12v1.48h-.76c-.75 0-.98.47-.98.95v1.14h1.67l-.27 2.9h-1.4V22c4.78-.81 8.44-4.94 8.44-9.93z"/>
            </svg>
          </a>

          <a
            className="share-btn icon email"
            href={shareEmail}
            aria-label="Share via Email"
            title="Email"
          >
            {/* Email SVG */}
            <svg className="icon-svg" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5L4 8V6l8 5 8-5v2z"/>
            </svg>
          </a>

          <button
            className="share-btn icon more"
            onClick={onNativeShare}
            aria-label="More share options"
            title="More"
            type="button"
          >
            {/* Share / More SVG */}
            <svg className="icon-svg" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7a3.7 3.7 0 000-1.4l7.02-4.11A2.99 2.99 0 1014 5c0 .12.01.24.03.36L7.03 9.47A3 3 0 107 15a3 3 0 00.97-1.79l7.05 4.12c-.02.12-.02.24-.02.36a2.99 2.99 0 103 3z"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="earnings-row">
        <div className="earn-col">
          <div className="earn-label">Your Earnings</div>
          <div className="earn-value">{earnings}</div>
        </div>
        <div className="earn-col">
          <div className="earn-label">Total Earned</div>
          <div className="earn-value green">{totalEarned}</div>
        </div>
      </div>
    </Modal>
  );
}