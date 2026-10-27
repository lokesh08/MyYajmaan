-- Messaging Center: internal person-to-person mail between any two
-- registered users (Yajmaan, Pandit Ji, Admin), with drafts. System
-- notifications (public.notifications) are unchanged and untouched --
-- the Inbox endpoint (routers/messaging.py) merges both at read time.

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_recipient ON public.messages(recipient_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id, status, created_at DESC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.messages FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO service_role;

NOTIFY pgrst, 'reload schema';
