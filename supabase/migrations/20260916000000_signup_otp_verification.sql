-- One-time email + phone OTP verification for self-registered
-- accounts (customer / Yajmaan and Pandit Ji).
--
-- signup_verification_pending is set to TRUE only by the public
-- registration endpoints and cleared once BOTH the email and the phone
-- have been verified. It defaults to FALSE, so every existing account
-- (and every admin-created / bulk-uploaded Pandit Ji) keeps logging in
-- exactly as before -- nobody is retroactively locked out.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS signup_verification_pending BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.signup_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL
    REFERENCES public.users(id)
    ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'phone')),
  destination TEXT NOT NULL,
  -- Only a keyed hash of the code is stored, never the code itself.
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lookups are always "latest OTP for this user + channel" and
-- "how many did we send them recently".
CREATE INDEX IF NOT EXISTS idx_signup_otps_user_channel_created
  ON public.signup_otps(user_id, channel, created_at DESC);

-- Written and read only through the backend's service-role client.
ALTER TABLE public.signup_otps ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.signup_otps TO service_role;

NOTIFY pgrst, 'reload schema';
