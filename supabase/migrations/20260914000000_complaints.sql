-- Complaint/dispute system: a Yajmaan can raise a complaint on a
-- completed booking; admin triages, threads replies, and resolves with
-- a verdict (valid -> optional refund via wallet.credit_wallet;
-- invalid -> admin may separately block the user via the existing
-- admin_users.py status endpoint, unrelated table).

CREATE TABLE IF NOT EXISTS public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  resolution TEXT CHECK (resolution IN ('valid', 'invalid')),
  refund_type TEXT CHECK (refund_type IN ('full', 'partial')),
  refund_amount NUMERIC,
  resolved_by UUID REFERENCES public.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one open/in-progress complaint per booking at a time -- enforced
-- at the DB level (a partial unique index), not just app-side
-- validation, so a race between two tabs can't slip past the check.
CREATE UNIQUE INDEX IF NOT EXISTS idx_complaints_one_open_per_booking
  ON public.complaints(booking_id) WHERE status IN ('open', 'in_progress');

CREATE INDEX IF NOT EXISTS idx_complaints_user ON public.complaints(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.complaint_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id),
  sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'admin')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_complaint_messages_complaint ON public.complaint_messages(complaint_id, created_at);

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.complaints FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.complaints TO service_role;

ALTER TABLE public.complaint_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.complaint_messages FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.complaint_messages TO service_role;

NOTIFY pgrst, 'reload schema';
