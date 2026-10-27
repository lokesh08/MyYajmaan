-- Link application users to Supabase Auth users
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS auth_uid UUID;

-- Supabase Auth owns passwords.
-- The application table should not require a second password hash.
ALTER TABLE public.users
ALTER COLUMN password_hash DROP NOT NULL;

-- One application profile per Supabase Auth user
CREATE UNIQUE INDEX IF NOT EXISTS users_auth_uid_unique
ON public.users(auth_uid);

-- Link public.users to auth.users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_auth_uid_fkey'
  ) THEN
    ALTER TABLE public.users
    ADD CONSTRAINT users_auth_uid_fkey
    FOREIGN KEY (auth_uid)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;
  END IF;
END $$;