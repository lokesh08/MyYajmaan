-- Pandit Ji portal: onboarding, profile, documents, bank details,
-- booking accept/decline, photo uploads, feedback-to-admin, and a
-- wallet withdrawal request queue. All changes are additive.

ALTER TABLE public.pandits
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS availability_pattern JSONB NOT NULL DEFAULT '{}'::jsonb;

-- New document slots for the 3-step onboarding wizard. The original
-- id_proof_url/certificate_url columns are left untouched (unused by
-- the new wizard, kept for backward compatibility).
ALTER TABLE public.pandit_registrations
  ADD COLUMN IF NOT EXISTS aadhar_front_url TEXT,
  ADD COLUMN IF NOT EXISTS aadhar_back_url TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Plain (non-sensitive) bank fields alongside the existing encrypted
-- account_no_enc/ifsc_enc/upi_id_enc columns.
ALTER TABLE public.pandit_bank_details
  ADD COLUMN IF NOT EXISTS account_holder_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT;

-- Puja-completion photos a pandit uploads against a booking.
CREATE TABLE IF NOT EXISTS public.booking_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  pandit_id UUID NOT NULL REFERENCES public.pandits(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_photos_booking
  ON public.booking_photos(booking_id);

-- Pandit -> admin platform feedback. Distinct from public.reviews,
-- which is customer -> pandit.
CREATE TABLE IF NOT EXISTS public.pandit_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pandit_id UUID NOT NULL REFERENCES public.pandits(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  rating SMALLINT CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pandit_feedback_pandit
  ON public.pandit_feedback(pandit_id, created_at DESC);

-- Withdrawal requests against a pandit's wallet balance. Approval/
-- payout processing is a future admin screen; this just queues the
-- request and records its state.
CREATE TABLE IF NOT EXISTS public.wallet_withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pandit_id UUID NOT NULL REFERENCES public.pandits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ,
  admin_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_wallet_withdrawal_requests_user
  ON public.wallet_withdrawal_requests(user_id, requested_at DESC);

ALTER TABLE public.booking_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pandit_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_withdrawal_requests ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA public
TO service_role;
GRANT USAGE, SELECT
ON ALL SEQUENCES IN SCHEMA public
TO service_role;

NOTIFY pgrst, 'reload schema';
