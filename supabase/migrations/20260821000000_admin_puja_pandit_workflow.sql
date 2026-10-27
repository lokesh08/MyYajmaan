-- Admin panel: Pandit Ji approval workflow + Puja CRUD (images, listing type).
-- All changes are additive (ADD COLUMN IF NOT EXISTS) so nothing existing breaks.

-- Pujas: image columns (PujaOut / routers/pujas.py already reference these,
-- but the columns never existed, so puja cards have always rendered with no
-- image). Also adds the admin-facing listing tag and audit stamps.
ALTER TABLE public.pujas
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS listing_type TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.pujas
  DROP CONSTRAINT IF EXISTS pujas_listing_type_valid;

ALTER TABLE public.pujas
  ADD CONSTRAINT pujas_listing_type_valid
  CHECK (listing_type IN ('normal', 'trending', 'featured'));

CREATE INDEX IF NOT EXISTS idx_pujas_listing_type
  ON public.pujas(listing_type);

-- Pandits: admin's note when rejecting a registration, shown to the Pandit
-- Ji so they know what to fix before re-submitting documents.
ALTER TABLE public.pandits
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

NOTIFY pgrst, 'reload schema';
