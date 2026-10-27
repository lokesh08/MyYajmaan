-- Server-side ledger of Razorpay orders, so a payment_ref a client sends
-- back (to create a booking, confirm a package-puja payment, or top up a
-- wallet) can be checked against a REAL payment this server itself
-- created and verified -- instead of trusting whatever amount/ref the
-- client claims. See routers/payments.py (writes this table) and
-- payment_verification.py (reads/consumes it).
--
-- Lifecycle: created (order opened) -> verified (signature checked) ->
-- consumed (spent on exactly one booking/top-up; every "spend" endpoint
-- consumes atomically so the same payment can never be reused).

CREATE TABLE IF NOT EXISTS public.payment_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL
    REFERENCES public.users(id)
    ON DELETE CASCADE,
  order_id TEXT NOT NULL UNIQUE,
  payment_id TEXT UNIQUE,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'verified', 'consumed', 'failed')),
  consumed_reference_type TEXT,
  consumed_reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ
);

-- "Do I have a verified, unspent payment with this payment_id, and does
-- it belong to this user?" is the one lookup every spend endpoint does.
CREATE INDEX IF NOT EXISTS idx_payment_verifications_payment_id
  ON public.payment_verifications(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_verifications_user_status
  ON public.payment_verifications(user_id, status);

-- Written and read only through the backend's service-role client.
ALTER TABLE public.payment_verifications ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.payment_verifications TO service_role;

NOTIFY pgrst, 'reload schema';
