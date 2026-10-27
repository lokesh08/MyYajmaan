-- audit_logs already records admin actions with actor_id, action, entity,
-- entity_id, payload, and created_at. This migration adds role scopes and 2FA state.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'admin_role_type'
  ) THEN
    CREATE TYPE public.admin_role_type AS ENUM (
      'super_admin',
      'support_admin',
      'finance_admin',
      'content_admin'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.admin_roles (
  user_id UUID PRIMARY KEY
    REFERENCES public.users(id)
    ON DELETE CASCADE,
  role_type public.admin_role_type NOT NULL,
  assigned_by UUID
    REFERENCES public.users(id)
    ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_2fa (
  user_id UUID PRIMARY KEY
    REFERENCES public.users(id)
    ON DELETE CASCADE,
  secret_key_enc TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  last_verified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_roles_role_type
  ON public.admin_roles(role_type);

-- TOTP secrets are application-encrypted and are only available to the service role.
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_2fa ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.admin_roles FROM anon, authenticated;
REVOKE ALL ON TABLE public.admin_2fa FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.admin_roles, public.admin_2fa
TO service_role;

NOTIFY pgrst, 'reload schema';
