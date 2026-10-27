-- Bookings now carry the actual pricing breakdown that was charged
-- (premium package fee, GST, platform fee, and which tier was chosen),
-- so admin's booking detail view is a complete record of what the
-- customer paid and why, not just a single opaque total.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS package_tier TEXT,
  ADD COLUMN IF NOT EXISTS premium_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_fee NUMERIC(10,2) NOT NULL DEFAULT 0;

NOTIFY pgrst, 'reload schema';
