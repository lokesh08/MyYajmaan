-- Completed and attempted payment transactions. payment_sessions remains the gateway-initiation table.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'payment_status'
  ) THEN
    CREATE TYPE public.payment_status AS ENUM (
      'pending',
      'paid',
      'failed',
      'refunded'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL
    REFERENCES public.bookings(id)
    ON DELETE RESTRICT,
  amount NUMERIC(10,2) NOT NULL,
  method TEXT NOT NULL,
  transaction_id TEXT UNIQUE,
  status public.payment_status NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payments_amount_nonnegative
    CHECK (amount >= 0),
  CONSTRAINT payments_method_allowed
    CHECK (method IN ('upi', 'card', 'netbanking', 'wallet')),
  CONSTRAINT payments_paid_at_when_paid
    CHECK (status <> 'paid' OR paid_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_payments_booking_id
  ON public.payments(booking_id);

CREATE INDEX IF NOT EXISTS idx_payments_status_created_at
  ON public.payments(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_paid_at
  ON public.payments(paid_at)
  WHERE paid_at IS NOT NULL;

DROP TRIGGER IF EXISTS set_timestamp_payments ON public.payments;
CREATE TRIGGER set_timestamp_payments
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE PROCEDURE public.trigger_set_timestamp();
