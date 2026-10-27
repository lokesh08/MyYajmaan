-- Allows administrators to hide a puja from the active client booking catalog.

ALTER TABLE public.pujas
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_pujas_active
  ON public.pujas(is_active)
  WHERE is_active = TRUE;
