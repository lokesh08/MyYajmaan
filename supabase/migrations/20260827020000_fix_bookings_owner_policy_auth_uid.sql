-- Follow-up fix: auth.uid() returns the Supabase Auth id, which lives
-- on public.users.auth_uid -- NOT public.users.id (the app's own
-- primary key, which is what bookings.client_id actually references).
-- The previous migration's "client_id = auth.uid()" compared two UUIDs
-- that are never equal for the same real user, so real customer
-- inserts/selects still failed RLS. Mirrors the join pattern the
-- pre-existing admin policy on this same table already uses.

DROP POLICY IF EXISTS bookings_select_owner ON public.bookings;
CREATE POLICY bookings_select_owner ON public.bookings
  FOR SELECT
  USING (
    client_id IN (SELECT id FROM public.users WHERE auth_uid = auth.uid())
  );

DROP POLICY IF EXISTS bookings_insert_owner ON public.bookings;
CREATE POLICY bookings_insert_owner ON public.bookings
  FOR INSERT
  WITH CHECK (
    client_id IN (SELECT id FROM public.users WHERE auth_uid = auth.uid())
  );

NOTIFY pgrst, 'reload schema';
