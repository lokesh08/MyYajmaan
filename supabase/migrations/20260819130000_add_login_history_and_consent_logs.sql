CREATE TABLE IF NOT EXISTS public.login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  device_id TEXT,
  device_name TEXT,
  device_type TEXT CHECK (
    device_type IS NULL OR device_type IN ('ios', 'android', 'web', 'unknown')
  ),
  ip_address INET,
  login_status TEXT NOT NULL CHECK (login_status IN ('success', 'failed')),
  login_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  logout_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.consent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  policy_type TEXT NOT NULL CHECK (
    policy_type IN ('terms_of_service', 'privacy_policy')
  ),
  policy_version TEXT NOT NULL,
  ip_address INET,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_history_user_login_at
  ON public.login_history(user_id, login_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_status_login_at
  ON public.login_history(login_status, login_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_logs_user_policy
  ON public.consent_logs(user_id, policy_type, accepted_at DESC);

ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.login_history FROM anon, authenticated;
REVOKE ALL ON TABLE public.consent_logs FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.login_history, public.consent_logs
TO service_role;

NOTIFY pgrst, 'reload schema';
