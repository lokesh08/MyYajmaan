-- Admin booking operations: retain the booked price while recording each
-- Pandit Ji reassignment and any higher replacement rate covered by MyYajmaan.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS catalog_puja_id UUID REFERENCES public.pujas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reassigned_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bookings_catalog_puja_id
  ON public.bookings(catalog_puja_id)
  WHERE catalog_puja_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.booking_assignment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  previous_pandit_id UUID REFERENCES public.pandits(id) ON DELETE SET NULL,
  assigned_pandit_id UUID REFERENCES public.pandits(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'pandit_declined', 'admin_reassigned')),
  assigned_price NUMERIC(10,2),
  platform_covered_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (platform_covered_amount >= 0),
  note TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_assignment_events_booking
  ON public.booking_assignment_events(booking_id, created_at DESC);

ALTER TABLE public.booking_assignment_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.booking_assignment_events FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_assignment_events TO service_role;

NOTIFY pgrst, 'reload schema';