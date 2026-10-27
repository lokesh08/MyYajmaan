CREATE TABLE IF NOT EXISTS public.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_user_id
  ON public.contact_messages(user_id);

CREATE INDEX IF NOT EXISTS idx_contact_messages_status
  ON public.contact_messages(status);

GRANT SELECT, INSERT, UPDATE
  ON TABLE public.contact_messages
  TO service_role;

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
