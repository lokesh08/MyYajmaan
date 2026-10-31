import React from 'react';
import Modal from './Modal';
import ReferralShare from './ReferralShare';
import './modals.css';

export default function ReferEarnModal({ open, onClose, data }) {
  // data: { code, signupReward, bookingReward, earnings, totalEarned } from GET /referral
  const d = data || {};
  // No made-up fallback code: if /referral failed there is nothing real
  // to share, so ReferralShare shows "—" and disables Copy/Share.
  const code = d.code || '';
  const signupReward = d.signupReward ?? '₹25';
  const bookingReward = d.bookingReward ?? '₹51';
  const earnings = d.earnings ?? '—';
  const totalEarned = d.totalEarned ?? '—';

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

      <ReferralShare code={code} />

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
