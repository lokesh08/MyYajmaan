-- Extends the existing per-Pandit timeslots table to support availability windows.
-- public.availability remains the legacy puja-level availability table.

ALTER TABLE public.timeslots
  ADD COLUMN IF NOT EXISTS end_time TIME WITHOUT TIME ZONE,
  ADD COLUMN IF NOT EXISTS is_booked BOOLEAN NOT NULL DEFAULT FALSE;

-- Existing rows represent one-hour availability windows until explicitly updated.
UPDATE public.timeslots
SET end_time = slot_time + INTERVAL '1 hour'
WHERE end_time IS NULL;

ALTER TABLE public.timeslots
  ALTER COLUMN end_time SET NOT NULL;

ALTER TABLE public.timeslots
  DROP CONSTRAINT IF EXISTS timeslots_time_window_valid;

ALTER TABLE public.timeslots
  ADD CONSTRAINT timeslots_time_window_valid
  CHECK (end_time > slot_time);

CREATE INDEX IF NOT EXISTS idx_timeslots_pandit_date_unbooked
  ON public.timeslots(pandit_id, slot_date, slot_time)
  WHERE available = TRUE AND is_booked = FALSE;

CREATE INDEX IF NOT EXISTS idx_timeslots_date_unbooked
  ON public.timeslots(slot_date, slot_time)
  WHERE available = TRUE AND is_booked = FALSE;
