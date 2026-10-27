-- Found while testing the real customer checkout -> "My Bookings" flow
-- for the Customer Portal (client_bookings.py / services/bookings.js).
--
-- public.bookings' RLS policies (bookings_select_owner/
-- bookings_insert_owner) check the legacy `user_id` column against
-- auth.uid() -- but user_id is a leftover INTEGER column from the very
-- first migration, never populated by any current code path (the real,
-- reliably-populated owner column is `client_id`, added later). Combined
-- with user_id/puja_id being NOT NULL and the `authenticated` role
-- having no SELECT/INSERT grant on bookings at all, a real logged-in
-- customer's own booking write has never actually been able to
-- succeed through their own session.

ALTER TABLE public.bookings
  ALTER COLUMN user_id DROP NOT NULL,
  ALTER COLUMN puja_id DROP NOT NULL;

DROP POLICY IF EXISTS bookings_select_owner ON public.bookings;
CREATE POLICY bookings_select_owner ON public.bookings
  FOR SELECT
  USING (client_id = auth.uid());

DROP POLICY IF EXISTS bookings_insert_owner ON public.bookings;
CREATE POLICY bookings_insert_owner ON public.bookings
  FOR INSERT
  WITH CHECK (client_id = auth.uid());

GRANT SELECT, INSERT ON public.bookings TO authenticated;

NOTIFY pgrst, 'reload schema';
