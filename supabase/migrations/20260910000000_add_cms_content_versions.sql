CREATE TABLE IF NOT EXISTS public.cms_content_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL REFERENCES public.cms_content(key) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  UNIQUE (key, version)
);

CREATE INDEX IF NOT EXISTS idx_cms_content_versions_latest
  ON public.cms_content_versions(key, version DESC);

ALTER TABLE public.cms_content_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cms_content_versions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_content_versions TO service_role;

-- Preserve the existing CMS entry, if one was saved before versioning.
INSERT INTO public.cms_content_versions (key, version, content, created_at, created_by)
SELECT key, 1, content, updated_at, updated_by
FROM public.cms_content
ON CONFLICT (key, version) DO NOTHING;

NOTIFY pgrst, 'reload schema';