-- Small generic key/value table for global app settings admin can
-- toggle -- starts with exactly one: whether new Pandit Ji
-- registrations skip Aadhaar OTP verification entirely (falling back
-- to manual Aadhaar-card-image review, same as the per-pandit
-- "Skip Aadhaar" admin override).

CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

INSERT INTO public.app_settings (key, value)
VALUES ('skip_aadhar_for_new_pandits', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

GRANT ALL ON public.app_settings TO service_role;

NOTIFY pgrst, 'reload schema';
