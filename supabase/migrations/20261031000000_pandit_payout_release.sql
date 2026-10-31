-- Pandit Ji payouts: a completed booking's pandit_fee_amount is no longer
-- held only on paper. Admin releases it to the Pandit Ji's wallet once the
-- puja is completed (and any complaint is settled); the Pandit Ji then
-- requests a withdrawal to their bank account as before.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS pandit_payout_released_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pandit_payout_released_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pandit_payout_amount NUMERIC(10,2);

CREATE INDEX IF NOT EXISTS idx_bookings_completed_payout_pending
  ON public.bookings(updated_at DESC)
  WHERE status = 'completed' AND pandit_payout_released_at IS NULL;

-- The actual bank transfer is done by admin outside the app; these record
-- what was sent so a "not received" query can be traced.
ALTER TABLE public.wallet_withdrawal_requests
  ADD COLUMN IF NOT EXISTS payout_reference TEXT,
  ADD COLUMN IF NOT EXISTS payout_method TEXT
    CHECK (payout_method IS NULL OR payout_method IN ('neft', 'imps', 'rtgs', 'upi', 'other'));
