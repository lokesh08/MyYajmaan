CREATE TABLE IF NOT EXISTS public.cms_content (
  key TEXT PRIMARY KEY,
  content JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

ALTER TABLE public.cms_content ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cms_content FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_content TO service_role;

NOTIFY pgrst, 'reload schema';