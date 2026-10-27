-- Extends public.users with profile, verification, and account-protection fields.
-- Existing email NOT NULL is intentionally preserved because the current auth flow uses email/password login.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'preferred_language'
  ) THEN
    CREATE TYPE public.preferred_language AS ENUM (
      'english',
      'hindi',
      'marathi',
      'gujarati'
    );
  END IF;
END $$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS language public.preferred_language,
  ADD COLUMN IF NOT EXISTS profile_image TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS failed_login_count SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_failed_login_count_nonnegative;

ALTER TABLE public.users
  ADD CONSTRAINT users_failed_login_count_nonnegative
  CHECK (failed_login_count >= 0);

CREATE INDEX IF NOT EXISTS idx_users_active
  ON public.users (is_active)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_locked_until
  ON public.users (locked_until)
  WHERE locked_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_deleted_at
  ON public.users (deleted_at)
  WHERE deleted_at IS NOT NULL;
