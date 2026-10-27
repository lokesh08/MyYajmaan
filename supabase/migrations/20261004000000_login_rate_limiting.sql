-- Backs login_rate_limit.py's brute-force protection on /auth/login and
-- /admin/auth/login (both go through routers/auth.py's shared
-- supabase_password_login). Deliberately separate from login_history
-- (which only ever logs an attempt against a REAL account, user_id
-- nullable but with no record of which email was actually typed) --
-- rate-limiting has to key on the attempted email even when no account
-- matches it at all, same reasoning as signup_otps being its own table
-- rather than overloading something else.

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address INET,
  success BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The two queries login_rate_limit.py actually runs: "how many failed
-- attempts against this email recently" and "...from this IP recently".
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_created
  ON public.login_attempts(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_created
  ON public.login_attempts(ip_address, created_at DESC);

-- Written and read only through the backend's service-role client.
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.login_attempts FROM anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.login_attempts TO service_role;

NOTIFY pgrst, 'reload schema';
