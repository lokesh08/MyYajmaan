-- Admin panel: Coupons/Offers admin CRUD, Shubh Muhurat per-puja discounts,
-- and a wallet ledger backing the signup bonus + referral rewards.
-- All changes are additive (ADD COLUMN IF NOT EXISTS) so nothing existing breaks.

-- Coupons: distinguishes admin-created general discount coupons from the
-- two system-managed referral reward amounts (which admin can still tune
-- via the "Referral Coupons" tab, but which drive automatic wallet
-- credits rather than a code a customer types in).
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS coupon_type TEXT NOT NULL DEFAULT 'general';

ALTER TABLE public.coupons
  DROP CONSTRAINT IF EXISTS coupons_coupon_type_valid;

ALTER TABLE public.coupons
  ADD CONSTRAINT coupons_coupon_type_valid
  CHECK (coupon_type IN ('general', 'referral_signup', 'referral_booking'));

CREATE INDEX IF NOT EXISTS idx_coupons_coupon_type
  ON public.coupons(coupon_type);

-- Seed the two referral reward "coupons". The universal ₹25 signup bonus
-- (every new customer, unrelated to referrals) is intentionally NOT a
-- coupon row — it's a fixed constant applied directly at registration.
INSERT INTO public.coupons (code, description, discount_type, discount_value, coupon_type, is_active)
VALUES
  ('REFERSIGNUP25', 'Reward credited to a user when a friend they referred signs up.', 'flat', 25, 'referral_signup', TRUE),
  ('REFERBOOKING51', 'Reward credited to a user when a friend they referred completes their first booking.', 'flat', 51, 'referral_booking', TRUE)
ON CONFLICT (code) DO NOTHING;

-- Wallet: balance on the user row for fast reads, plus who referred them.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  -- Idempotency flag on the REFERRED user: guards the referrer's
  -- first-booking reward against firing more than once (e.g. if the
  -- referred user deletes and re-creates their first booking).
  ADD COLUMN IF NOT EXISTS referral_first_booking_rewarded BOOLEAN NOT NULL DEFAULT FALSE;

-- Wallet transactions: the audit ledger every credit/debit is written to.
-- This is the single source of truth for "earnings"/"total earned" figures
-- and any future Wallet & Transactions admin screen — nothing else caches
-- a running total that could drift out of sync.
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  balance_after NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user
  ON public.wallet_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reason
  ON public.wallet_transactions(reason);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.wallet_transactions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.wallet_transactions
TO service_role;

-- Muhrats: per-puja discount overrides. discount_percent stays as the
-- flat/"all other pujas" fallback rate.
ALTER TABLE public.muhrats
  ADD COLUMN IF NOT EXISTS puja_discounts JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
