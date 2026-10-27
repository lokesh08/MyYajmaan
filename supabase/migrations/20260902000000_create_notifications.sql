-- In-app, real-time notifications for all three roles (customer,
-- Pandit Ji, admin). Always written and read through the backend's
-- service-role client (see routers/notifications.py) -- same pattern
-- as client_addresses etc. -- so no RLS policies are needed here.

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL
    REFERENCES public.users(id)
    ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The notification bell only ever queries "my unread, newest first"
-- or "my unread count", so this one composite index covers both.
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_created
  ON public.notifications(user_id, is_read, created_at DESC);

GRANT ALL ON public.notifications TO service_role;

NOTIFY pgrst, 'reload schema';
