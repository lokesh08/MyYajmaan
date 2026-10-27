-- The Addresses screen now collects State (dropdown) alongside City
-- (dependent dropdown, both backed by public.cities), so the address
-- book needs somewhere to persist it.

ALTER TABLE public.client_addresses
  ADD COLUMN IF NOT EXISTS state TEXT;

NOTIFY pgrst, 'reload schema';
