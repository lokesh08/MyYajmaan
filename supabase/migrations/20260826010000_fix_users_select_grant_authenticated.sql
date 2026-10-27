-- The "authenticated" Postgres role was missing SELECT on public.users
-- (the "anon" role already had it, which was itself an inversion).
-- Without SELECT, Postgres can't validate the client_id/pandit_id
-- foreign keys on public.bookings when a logged-in customer creates a
-- booking through their own per-request token-scoped Supabase client,
-- causing "permission denied for table users" on every booking
-- creation. Found while testing the Pandit Ji Portal's booking
-- accept/decline flow end-to-end.

GRANT SELECT ON public.users TO authenticated;

NOTIFY pgrst, 'reload schema';
