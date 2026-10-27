-- muhrats and referrals (both created in the very first
-- 20260810090004_add_muhrats_and_referrals.sql migration) are missing
-- the service_role table grants that 20260817100000_grant_service_permissions.sql
-- gave to every other table. Re-applying broadly here is a safe no-op
-- for tables that already have the grant.

GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA public
TO service_role;

GRANT USAGE, SELECT
ON ALL SEQUENCES IN SCHEMA public
TO service_role;

NOTIFY pgrst, 'reload schema';
