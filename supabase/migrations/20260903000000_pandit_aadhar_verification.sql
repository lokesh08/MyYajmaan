-- Aadhaar OTP authentication for Pandit Ji onboarding, replacing the
-- old raw Aadhaar front/back photo upload. See notifications-style
-- docstring in routers/pandit_aadhar.py for the full flow and the
-- mock-provider test values (no licensed UIDAI integration yet).

ALTER TABLE pandits ADD COLUMN IF NOT EXISTS aadhar_number_enc TEXT;

-- What the (mocked) UIDAI response said the name/phone on record are --
-- kept so a mismatch can be re-checked after the pandit corrects their
-- profile, without needing a fresh OTP round-trip.
ALTER TABLE pandits ADD COLUMN IF NOT EXISTS aadhar_name_on_record TEXT;
ALTER TABLE pandits ADD COLUMN IF NOT EXISTS aadhar_phone_on_record TEXT;

ALTER TABLE pandits ADD COLUMN IF NOT EXISTS aadhar_verification_status TEXT NOT NULL DEFAULT 'not_started';

ALTER TABLE pandits DROP CONSTRAINT IF EXISTS pandits_aadhar_verification_status_check;
ALTER TABLE pandits ADD CONSTRAINT pandits_aadhar_verification_status_check
  CHECK (aadhar_verification_status IN ('not_started', 'otp_sent', 'verified', 'mismatch', 'skipped'));

ALTER TABLE pandits ADD COLUMN IF NOT EXISTS aadhar_verified_at TIMESTAMPTZ;

-- Transient OTP session state -- never the OTP itself, only its hash.
ALTER TABLE pandits ADD COLUMN IF NOT EXISTS aadhar_otp_hash TEXT;
ALTER TABLE pandits ADD COLUMN IF NOT EXISTS aadhar_otp_sent_at TIMESTAMPTZ;
ALTER TABLE pandits ADD COLUMN IF NOT EXISTS aadhar_otp_attempts INTEGER NOT NULL DEFAULT 0;

-- Admin's manual override for a pandit whose Aadhaar isn't linked to
-- a mobile number (so OTP can never reach them) -- see PATCH
-- /admin/pandits/{id}/skip-aadhar. Only ever settable while the
-- pandit is still "pending", enforced in the endpoint, not here.
ALTER TABLE pandits ADD COLUMN IF NOT EXISTS aadhar_verification_skipped_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE pandits ADD COLUMN IF NOT EXISTS aadhar_verification_skipped_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
