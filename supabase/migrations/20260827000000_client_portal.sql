-- Customer portal: profile fields, booking reschedule/cancel tracking,
-- and feedback photos. All changes are additive.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS gender TEXT;

-- Reschedule/cancel bookkeeping. original_booking_date/
-- original_muhurat_time_slot let the UI show "rescheduled from X to Y"
-- directly off the row, without joining audit_logs.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancellation_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reschedule_fee_charged NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rescheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS original_booking_date DATE,
  ADD COLUMN IF NOT EXISTS original_muhurat_time_slot TEXT;

-- Feedback photos (customer -> admin testimonial submission).
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS photo_urls TEXT[] NOT NULL DEFAULT '{}'::text[];

GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA public
TO service_role;
GRANT USAGE, SELECT
ON ALL SEQUENCES IN SCHEMA public
TO service_role;

NOTIFY pgrst, 'reload schema';
