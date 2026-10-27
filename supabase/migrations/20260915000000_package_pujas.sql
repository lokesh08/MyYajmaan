-- Package Puja: a second puja category (24-Hr Package, Wedding Event,
-- Ram Katha, etc.) where price can't be fixed up front -- the Yajmaan
-- submits a request with no payment and no Pandit Ji picked, admin
-- reviews/calls/quotes a price, the Yajmaan pays in-portal, and only
-- then does admin assign a Pandit Ji -- at which point it's an
-- ordinary booking to the rest of the system (status="pending_pandit",
-- same accept/decline/complete flow as every normal booking).

ALTER TABLE public.pujas
  ADD COLUMN IF NOT EXISTS puja_type TEXT NOT NULL DEFAULT 'normal' CHECK (puja_type IN ('normal', 'package'));

-- A package booking has no amount until admin quotes it.
ALTER TABLE public.bookings ALTER COLUMN amount DROP NOT NULL;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS booking_type TEXT NOT NULL DEFAULT 'normal' CHECK (booking_type IN ('normal', 'package')),
  ADD COLUMN IF NOT EXISTS event_details TEXT,
  ADD COLUMN IF NOT EXISTS quoted_price NUMERIC,
  ADD COLUMN IF NOT EXISTS quoted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS quoted_by UUID REFERENCES public.users(id);

-- A package booking's *first* Pandit Ji assignment -- distinct from
-- 'created' (implies the customer picked them) and 'admin_reassigned'
-- (implies a prior Pandit Ji existed and declined).
ALTER TABLE public.booking_assignment_events DROP CONSTRAINT IF EXISTS booking_assignment_events_action_check;
ALTER TABLE public.booking_assignment_events ADD CONSTRAINT booking_assignment_events_action_check
  CHECK (action = ANY (ARRAY['created'::text, 'pandit_declined'::text, 'pandit_accepted'::text, 'admin_reassigned'::text, 'admin_assigned'::text]));

CREATE INDEX IF NOT EXISTS idx_bookings_booking_type ON public.bookings(booking_type, status);

NOTIFY pgrst, 'reload schema';
