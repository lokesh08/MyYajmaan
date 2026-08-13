-- add_pandit_puja_relation.sql
CREATE TABLE IF NOT EXISTS pandit_puja (
  id BIGSERIAL PRIMARY KEY,
  pandit_id UUID NOT NULL REFERENCES pandits(id) ON DELETE CASCADE,
  puja_id UUID NOT NULL REFERENCES pujas(id) ON DELETE CASCADE,
  price_override NUMERIC,
  featured BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pandit_id, puja_id)
);

DROP TRIGGER IF EXISTS set_timestamp_pandit_puja ON pandit_puja;
CREATE TRIGGER set_timestamp_pandit_puja
BEFORE UPDATE ON pandit_puja
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE INDEX IF NOT EXISTS idx_pandit_puja_puja ON pandit_puja(puja_id);
CREATE INDEX IF NOT EXISTS idx_pandit_puja_pandit ON pandit_puja(pandit_id);
