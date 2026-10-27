-- Supabase Cloud enables row level security by default on every new
-- public-schema table; the local self-hosted stack does not, which is
-- how pujas/festivals/muhrats ended up with RLS on locally-disabled
-- but on Cloud left RLS on with zero policies -- silently returning
-- no rows to the anon key the backend's public read-only endpoints
-- (routers/pujas.py, routers/festivals.py, routers/muhrats.py) use.
-- cities/pandits already had a working anon-select policy; this adds
-- the matching ones for the other three public catalog tables.

ALTER TABLE public.pujas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pujas_select_public" ON public.pujas;
CREATE POLICY "pujas_select_public" ON public.pujas
  FOR SELECT USING (is_active = true);

ALTER TABLE public.festivals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "festivals_select_public" ON public.festivals;
CREATE POLICY "festivals_select_public" ON public.festivals
  FOR SELECT USING (true);

ALTER TABLE public.muhrats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "muhrats_select_public" ON public.muhrats;
CREATE POLICY "muhrats_select_public" ON public.muhrats
  FOR SELECT USING (active = true);
