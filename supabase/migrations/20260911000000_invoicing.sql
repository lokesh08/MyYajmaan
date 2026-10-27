-- Invoicing: real per-fee tracking on bookings, plus the tables backing
-- GST-compliant customer invoices and Pandit Ji payment statements.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS original_pandit_fee_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS pandit_fee_amount NUMERIC;

-- Backfill for existing bookings created before this column existed, so
-- older completed bookings can still generate a reasonably accurate
-- invoice instead of showing a blank fee line. Best-effort arithmetic
-- from the columns that did already exist.
UPDATE public.bookings
SET
  original_pandit_fee_amount = GREATEST(
    0,
    COALESCE(amount, 0) - COALESCE(gst_amount, 0) - COALESCE(platform_fee, 0) - COALESCE(premium_fee, 0) + COALESCE(coupon_discount, 0)
  ),
  pandit_fee_amount = GREATEST(
    0,
    COALESCE(amount, 0) - COALESCE(gst_amount, 0) - COALESCE(platform_fee, 0) - COALESCE(premium_fee, 0) + COALESCE(coupon_discount, 0)
  )
WHERE original_pandit_fee_amount IS NULL;

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  invoice_type TEXT NOT NULL CHECK (invoice_type IN ('customer', 'pandit')),
  invoice_number TEXT NOT NULL UNIQUE,
  financial_year TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  snapshot JSONB NOT NULL,
  UNIQUE (booking_id, invoice_type)
);

CREATE INDEX IF NOT EXISTS idx_invoices_booking_id ON public.invoices(booking_id);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invoices FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO service_role;

-- Keyed by (financial_year, prefix) rather than financial_year alone so
-- the customer-facing Tax Invoice series (INV/...) stays gapless and
-- gets its own clean 1,2,3... run per Rule 46(b) -- independent of the
-- Pandit Ji Payment Statement series (PAY/...), which isn't a GST tax
-- invoice at all and doesn't need to interleave with it.
CREATE TABLE IF NOT EXISTS public.invoice_sequences (
  financial_year TEXT NOT NULL,
  prefix TEXT NOT NULL,
  next_number INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (financial_year, prefix)
);

ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invoice_sequences FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_sequences TO service_role;

-- Atomic "give me the next number for this series" -- avoids a race
-- condition if a customer and pandit invoice (or two bookings) get
-- generated at the same moment. Returns the fully formatted invoice
-- number, e.g. next_invoice_number('2026-27', 'INV') -> 'INV/2026-27/00001'.
CREATE OR REPLACE FUNCTION public.next_invoice_number(fy TEXT, p_prefix TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  seq_number INTEGER;
BEGIN
  INSERT INTO public.invoice_sequences (financial_year, prefix, next_number)
  VALUES (fy, p_prefix, 2)
  ON CONFLICT (financial_year, prefix)
  DO UPDATE SET next_number = public.invoice_sequences.next_number + 1
  RETURNING next_number - 1 INTO seq_number;

  RETURN p_prefix || '/' || fy || '/' || lpad(seq_number::text, 5, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_invoice_number(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_invoice_number(TEXT, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
