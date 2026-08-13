-- add_festivals.sql
CREATE TABLE IF NOT EXISTS festivals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  image_url TEXT,
  highlight BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT ''::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_timestamp_festivals ON festivals;
CREATE TRIGGER set_timestamp_festivals
BEFORE UPDATE ON festivals
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE INDEX IF NOT EXISTS idx_festivals_start_date ON festivals(start_date);
CREATE INDEX IF NOT EXISTS idx_festivals_highlight ON festivals(highlight);


