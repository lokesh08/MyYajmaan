-- Extends legacy public.bookings toward the normalized core transaction model.
-- Legacy user_id, date, and timeslot columns are preserved for backwards compatibility.
-- coupon_id is intentionally not given an FK until public.coupons is introduced.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS client_id UUID
    REFERENCES public.users(id)
    ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS address_id UUID
    REFERENCES public.client_addresses(id)
    ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS booking_date DATE,
  ADD COLUMN IF NOT EXISTS muhurat_time_slot TEXT,
  ADD COLUMN IF NOT EXISTS cashback_applied NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID
    REFERENCES public.users(id)
    ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelled_reason TEXT,
  ADD COLUMN IF NOT EXISTS coupon_id UUID,
  ADD COLUMN IF NOT EXISTS coupon_discount NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Copy existing legacy values to their normalized replacements where available.
UPDATE public.bookings
SET booking_date = date
WHERE booking_date IS NULL AND date IS NOT NULL;

UPDATE public.bookings
SET muhurat_time_slot = timeslot
WHERE muhurat_time_slot IS NULL AND timeslot IS NOT NULL;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_cashback_applied_nonnegative,
  DROP CONSTRAINT IF EXISTS bookings_coupon_discount_nonnegative,
  DROP CONSTRAINT IF EXISTS bookings_amount_nonnegative;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_cashback_applied_nonnegative
    CHECK (cashback_applied >= 0),
  ADD CONSTRAINT bookings_coupon_discount_nonnegative
    CHECK (coupon_discount >= 0),
  ADD CONSTRAINT bookings_amount_nonnegative
    CHECK (amount IS NULL OR amount >= 0);

CREATE INDEX IF NOT EXISTS idx_bookings_client_id
  ON public.bookings(client_id)
  WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_booking_date
  ON public.bookings(booking_date)
  WHERE booking_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_status_booking_date
  ON public.bookings(status, booking_date)
  WHERE booking_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_address_id
  ON public.bookings(address_id)
  WHERE address_id IS NOT NULL;
