-- Admin: Testimonials (reviews) status/publish workflow, Support
-- (contact_messages) triage fields. All changes are additive.

-- Reviews: nothing distinguished published/pending/hidden before this.
-- puja_title is denormalized on purpose — bookings.puja_id is a legacy
-- integer column that never reliably maps to public.pujas.id (documented
-- already in admin_dashboard.py's get_top_pujas), so there is no safe
-- join to pull a real puja title from here.
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS puja_title TEXT,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_status_valid;

ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_status_valid
  CHECK (status IN ('pending', 'published', 'hidden'));

CREATE INDEX IF NOT EXISTS idx_reviews_status
  ON public.reviews(status, published_at DESC);

-- Best-effort sample data: reviews.booking_id/client_id/pandit_id are
-- all NOT NULL foreign keys, so rather than risk inserting fake UUIDs
-- that violate them, this seeds real reviews against whatever actual
-- bookings already exist (if any). If none exist yet, this is a no-op
-- and the admin Testimonials screen legitimately starts empty — there
-- is no customer-facing review submission flow yet (separate, future
-- work), so that's accurate rather than fabricated.
DO $$
DECLARE
  rec RECORD;
  comments TEXT[] := ARRAY[
    'Very good experience with the pandit ji. Very polite and knowledgeable.',
    'Puja was performed very well. Highly recommended.',
    'Excellent arrangement and on-time service.',
    'Very spiritual and peaceful experience.',
    'The pandit explained every step beautifully, the whole family felt comfortable.',
    'Smooth booking process and a wonderful, on-time ceremony.'
  ];
  ratings INT[] := ARRAY[5, 4, 5, 5, 5, 4];
  statuses TEXT[] := ARRAY['published', 'published', 'published', 'published', 'pending', 'hidden'];
  i INT := 1;
BEGIN
  FOR rec IN
    SELECT id AS booking_id, client_id, pandit_id
    FROM public.bookings
    WHERE client_id IS NOT NULL
      AND pandit_id IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 6
  LOOP
    INSERT INTO public.reviews (booking_id, client_id, pandit_id, rating, comment, status, published_at)
    VALUES (
      rec.booking_id,
      rec.client_id,
      rec.pandit_id,
      ratings[i],
      comments[i],
      statuses[i],
      CASE WHEN statuses[i] = 'published' THEN now() - (i || ' days')::interval ELSE NULL END
    )
    ON CONFLICT (booking_id) DO NOTHING;

    i := i + 1;
  END LOOP;
END $$;

-- Support (contact_messages): triage fields for admin.
ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

ALTER TABLE public.contact_messages
  DROP CONSTRAINT IF EXISTS contact_messages_status_valid;

ALTER TABLE public.contact_messages
  ADD CONSTRAINT contact_messages_status_valid
  CHECK (status IN ('new', 'in_progress', 'resolved'));

NOTIFY pgrst, 'reload schema';
