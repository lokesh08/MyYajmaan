CREATE TABLE IF NOT EXISTS public.user_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL
    REFERENCES public.users(id)
    ON DELETE CASCADE,
  flag_type TEXT NOT NULL CHECK (
    flag_type IN ('suspended', 'banned', 'under_review')
  ),
  reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  flagged_by UUID NOT NULL
    REFERENCES public.users(id)
    ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_flags_not_self_applied CHECK (user_id <> flagged_by)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_flags_one_active_per_user
  ON public.user_flags(user_id)
  WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_user_flags_active_type
  ON public.user_flags(is_active, flag_type, created_at DESC);

ALTER TABLE public.user_flags ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_flags FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.user_flags
TO service_role;

NOTIFY pgrst, 'reload schema';
