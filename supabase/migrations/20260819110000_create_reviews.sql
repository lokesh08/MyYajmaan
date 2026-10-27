-- Client feedback for completed Pandit bookings.

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE
    REFERENCES public.bookings(id)
    ON DELETE CASCADE,
  client_id UUID NOT NULL
    REFERENCES public.users(id)
    ON DELETE RESTRICT,
  pandit_id UUID NOT NULL
    REFERENCES public.pandits(id)
    ON DELETE RESTRICT,
  rating SMALLINT NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reviews_rating_range
    CHECK (rating BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS idx_reviews_pandit_created_at
  ON public.reviews(pandit_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_client_created_at
  ON public.reviews(client_id, created_at DESC);
