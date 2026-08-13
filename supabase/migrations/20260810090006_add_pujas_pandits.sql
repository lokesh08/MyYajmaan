-- add_pujas_pandits.sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS pujas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER,
  base_price NUMERIC,
  category TEXT,
  shubh_available BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_timestamp_pujas ON pujas;
CREATE TRIGGER set_timestamp_pujas
BEFORE UPDATE ON pujas
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TABLE IF NOT EXISTS pandits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT,
  languages TEXT[],
  experience_years INTEGER,
  rating NUMERIC(2,1) DEFAULT 0,
  price NUMERIC,
  about TEXT,
  avatar_url TEXT,
  address TEXT,
  city TEXT,
  pin TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_timestamp_pandits ON pandits;
CREATE TRIGGER set_timestamp_pandits
BEFORE UPDATE ON pandits
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- CREATE INDEX IF NOT EXISTS idx_pandits_city ON pandits(city); (commented temporarily)
-- CREATE INDEX IF NOT EXISTS idx_pandits_is_active ON pandits(is_active); (commented temporarily)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pandits' AND column_name = 'city'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_pandits_city ON pandits(city)';
  END IF;
END;
$$;DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pandits' AND column_name = 'is_active'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_pandits_is_active ON pandits(is_active)';
  END IF;
END;
$$;




