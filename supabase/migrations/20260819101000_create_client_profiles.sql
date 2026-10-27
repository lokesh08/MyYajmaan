-- Client-only account data. Shared identity fields remain in public.users.

CREATE TABLE IF NOT EXISTS public.client_profiles (
  user_id UUID PRIMARY KEY
    REFERENCES public.users(id)
    ON DELETE CASCADE,
  referral_code TEXT NOT NULL UNIQUE,
  referred_by UUID
    REFERENCES public.users(id)
    ON DELETE SET NULL,
  wallet_balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_profiles_wallet_balance_nonnegative
    CHECK (wallet_balance >= 0),
  CONSTRAINT client_profiles_no_self_referral
    CHECK (referred_by IS NULL OR referred_by <> user_id)
);

CREATE INDEX IF NOT EXISTS idx_client_profiles_referred_by
  ON public.client_profiles(referred_by)
  WHERE referred_by IS NOT NULL;

DROP TRIGGER IF EXISTS set_timestamp_client_profiles ON public.client_profiles;
CREATE TRIGGER set_timestamp_client_profiles
BEFORE UPDATE ON public.client_profiles
FOR EACH ROW
EXECUTE PROCEDURE public.trigger_set_timestamp();
