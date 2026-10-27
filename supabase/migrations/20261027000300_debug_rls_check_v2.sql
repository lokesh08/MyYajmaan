CREATE OR REPLACE FUNCTION public.debug_pujas_rls_state()
RETURNS TABLE(relname text, relrowsecurity boolean, relforcerowsecurity boolean)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT c.relname::text, c.relrowsecurity, c.relforcerowsecurity
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname IN ('pujas', 'pandits', 'cities', 'festivals', 'muhrats');
$$;

GRANT EXECUTE ON FUNCTION public.debug_pujas_rls_state() TO anon;
