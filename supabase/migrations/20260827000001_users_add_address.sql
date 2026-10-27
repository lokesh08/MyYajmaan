-- Missed in the previous client-portal migration: My Profile also has
-- a free-text Address field (per the approved screenshot), separate
-- from the structured client_addresses book used during checkout.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS address TEXT;

NOTIFY pgrst, 'reload schema';
