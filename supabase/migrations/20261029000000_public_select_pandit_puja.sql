-- pandit_puja (which pandit performs which puja, at what fee) is read
-- with the anon key by the public pandit endpoints (routers/pandits.py:
-- the booking flow's pandit list, starting prices, a pandit's puja
-- list). It was left out of 20261027000000/20261027000400, so on
-- Supabase Cloud (RLS on by default, no grant) anon reads came back
-- empty -- every pandit looked like they offered no pujas and the
-- booking flow showed "No Pandit Ji available" for every search.
-- Only active offerings are exposed; fees are public anyway (shown on
-- the booking page).

GRANT SELECT ON public.pandit_puja TO anon;

ALTER TABLE public.pandit_puja ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pandit_puja_select_public" ON public.pandit_puja;
CREATE POLICY "pandit_puja_select_public" ON public.pandit_puja
  FOR SELECT USING (active = true);

NOTIFY pgrst, 'reload schema';
