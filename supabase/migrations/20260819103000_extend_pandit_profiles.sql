-- Extends the existing public.pandits one-to-one profile table.
-- Existing columns remain supported: languages, about, rating, and is_active.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'pandit_verification_status'
  ) THEN
    CREATE TYPE public.pandit_verification_status AS ENUM (
      'pending',
      'approved',
      'rejected'
    );
  END IF;
END $$;

ALTER TABLE public.pandits
  ADD COLUMN IF NOT EXISTS specialities TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS languages_spoken TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS service_areas TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS rating_avg NUMERIC(2,1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_bookings INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verification_status public.pandit_verification_status NOT NULL DEFAULT 'pending';

ALTER TABLE public.pandits
  DROP CONSTRAINT IF EXISTS pandits_experience_years_nonnegative,
  DROP CONSTRAINT IF EXISTS pandits_rating_avg_range,
  DROP CONSTRAINT IF EXISTS pandits_total_bookings_nonnegative;

ALTER TABLE public.pandits
  ADD CONSTRAINT pandits_experience_years_nonnegative
    CHECK (experience_years IS NULL OR experience_years >= 0),
  ADD CONSTRAINT pandits_rating_avg_range
    CHECK (rating_avg BETWEEN 0 AND 5),
  ADD CONSTRAINT pandits_total_bookings_nonnegative
    CHECK (total_bookings >= 0);

CREATE INDEX IF NOT EXISTS idx_pandits_verification_status
  ON public.pandits(verification_status);

CREATE INDEX IF NOT EXISTS idx_pandits_specialities
  ON public.pandits USING GIN (specialities);

CREATE INDEX IF NOT EXISTS idx_pandits_languages_spoken
  ON public.pandits USING GIN (languages_spoken);

CREATE INDEX IF NOT EXISTS idx_pandits_service_areas
  ON public.pandits USING GIN (service_areas);
