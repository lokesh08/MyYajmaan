-- Supports three related features:
--   1. Admin bulk-uploading Pandit Ji accounts from a spreadsheet, each
--      created with a temporary password the pandit must change before
--      they go live in the app.
--   2. Admin resetting an existing Pandit Ji's password (same temp-
--      password + forced-change mechanic).
--   3. Self-service "Forgot password" for customers and Pandit Ji.

-- Forces a password change at next login. Set on bulk-created accounts
-- and whenever admin resets a Pandit Ji's password; cleared once the
-- account holder sets their own new password.
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

-- First-activation marker. A bulk-uploaded pandit is created already
-- "approved" but with pandits.is_active = FALSE (so they don't show up
-- for booking yet); this is stamped -- and is_active flipped to TRUE --
-- the first time they complete the mandatory password change. Left
-- alone on any later admin-triggered password reset, so that doesn't
-- silently reactivate a pandit admin deactivated for an unrelated reason.
ALTER TABLE pandits ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;

-- Traceability: which admin bulk-created this pandit record (NULL for
-- pandits who self-registered through the normal onboarding wizard).
ALTER TABLE pandits ADD COLUMN IF NOT EXISTS created_by_admin_id UUID REFERENCES users(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
