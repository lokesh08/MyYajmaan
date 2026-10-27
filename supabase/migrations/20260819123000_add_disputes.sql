DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'dispute_status'
  ) THEN
    CREATE TYPE public.dispute_status AS ENUM (
      'open',
      'investigating',
      'resolved',
      'rejected'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL
    REFERENCES public.bookings(id)
    ON DELETE RESTRICT,
  raised_by UUID NOT NULL
    REFERENCES public.users(id)
    ON DELETE RESTRICT,
  against_user UUID
    REFERENCES public.users(id)
    ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  status public.dispute_status NOT NULL DEFAULT 'open',
  resolution_notes TEXT,
  resolved_by UUID
    REFERENCES public.users(id)
    ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT disputes_no_self_dispute CHECK (
    against_user IS NULL OR raised_by <> against_user
  ),
  CONSTRAINT disputes_resolution_metadata CHECK (
    (status IN ('resolved', 'rejected') AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL)
    OR status NOT IN ('resolved', 'rejected')
  )
);

CREATE INDEX IF NOT EXISTS idx_disputes_booking_id
  ON public.disputes(booking_id);
CREATE INDEX IF NOT EXISTS idx_disputes_raised_by
  ON public.disputes(raised_by);
CREATE INDEX IF NOT EXISTS idx_disputes_status_created_at
  ON public.disputes(status, created_at DESC);

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.disputes FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.disputes
TO service_role;

NOTIFY pgrst, 'reload schema';
