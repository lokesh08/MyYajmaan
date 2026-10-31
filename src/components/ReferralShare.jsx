import { useState } from "react";

import { SOCIAL_ICONS } from "../constants/socialIcons";
import { buildReferralLink, buildReferralShareText, normalizeReferralCode } from "../utils/referral";
import "./modals.css";

// Referral code + "Copy Link" + share buttons, shared by the home page's
// Refer & Earn popup (ReferEarnModal) and the dashboard Refer & Earn page.
// Everything copied/shared is the full sign-up link (…/register?ref=CODE),
// so a friend who opens it lands on Register already referred.
export default function ReferralShare({ code }) {
  const [copied, setCopied] = useState(false);
  const cleanCode = normalizeReferralCode(code);
  const link = buildReferralLink(cleanCode, window.location.origin);
  const shareText = buildReferralShareText(cleanCode, link);

  async function handleCopy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      if (window.sendAnalytics) window.sendAnalytics("referral_copy", { code: cleanCode });
    } catch {
      window.prompt("Copy your referral link", link);
    }
  }

  async function handleNativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join MyYajmaan", text: shareText, url: link });
        if (window.sendAnalytics) window.sendAnalytics("referral_native_share", { code: cleanCode });
      } catch {
        /* ignore share cancellation/errors */
      }
    } else {
      handleCopy();
    }
  }

  const shareTargets = [
    { key: "whatsapp", label: "Share via WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(shareText)}`, external: true },
    {
      key: "facebook",
      label: "Share on Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}&quote=${encodeURIComponent(shareText)}`,
      external: true,
    },
    {
      key: "email",
      label: "Share via Email",
      href: `mailto:?subject=${encodeURIComponent("Join MyYajmaan")}&body=${encodeURIComponent(shareText)}`,
    },
  ];

  return (
    <>
      <div className="referral-row">
        <div className="ref-label">Your Referral Code</div>
        <div className="ref-code">{cleanCode || "—"}</div>
        <button className="btn-copy" onClick={handleCopy} type="button" disabled={!link}>
          {copied ? "Copied" : "Copy Link"}
        </button>
      </div>
      {link && (
        <p className={`ref-link${copied ? " ref-link-copied" : ""}`} title={link}>
          {copied ? "Link copied! Send it to your friend — they sign up from it and you both earn." : link}
        </p>
      )}

      <div className="share-row">
        <div className="share-title">Share your link</div>
        <div className="share-buttons">
          {shareTargets.map((target) => (
            <a
              key={target.key}
              className="share-btn share-btn-brand"
              href={link ? target.href : undefined}
              target={target.external ? "_blank" : undefined}
              rel={target.external ? "noopener noreferrer" : undefined}
              aria-label={target.label}
              title={target.label}
            >
              <img src={SOCIAL_ICONS[target.key]} alt="" aria-hidden="true" loading="lazy" decoding="async" />
            </a>
          ))}
          <button className="share-btn icon more" onClick={handleNativeShare} aria-label="More share options" title="More" type="button" disabled={!link}>
            <svg className="icon-svg" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7a3.7 3.7 0 000-1.4l7.02-4.11A2.99 2.99 0 1014 5c0 .12.01.24.03.36L7.03 9.47A3 3 0 107 15a3 3 0 00.97-1.79l7.05 4.12c-.02.12-.02.24-.02.36a2.99 2.99 0 103 3z" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
