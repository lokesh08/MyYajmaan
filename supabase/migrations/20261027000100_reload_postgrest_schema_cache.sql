-- Force PostgREST to pick up the anon GRANTs from the previous migration
-- immediately instead of waiting for its own cache refresh interval.
NOTIFY pgrst, 'reload schema';
