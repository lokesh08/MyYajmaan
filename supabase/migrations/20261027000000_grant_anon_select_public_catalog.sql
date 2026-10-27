-- Public catalog tables the frontend reads directly with the anon key
-- (browsing pujas/pandits/cities/festivals/muhrats before login). This
-- grant existed on the local database but was applied by hand and never
-- captured in a migration, so a fresh project (e.g. Supabase Cloud) was
-- missing it and returned empty results for anon reads.
GRANT SELECT ON public.pujas TO anon;
GRANT SELECT ON public.pandits TO anon;
GRANT SELECT ON public.cities TO anon;
GRANT SELECT ON public.festivals TO anon;
GRANT SELECT ON public.muhrats TO anon;
