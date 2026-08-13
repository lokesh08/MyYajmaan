-- add_timeslots.sql
CREATE TABLE IF NOT EXISTS timeslots (
  id BIGSERIAL PRIMARY KEY,
  pandit_id UUID NOT NULL REFERENCES pandits(id) ON DELETE CASCADE,
  slot_date DATE NOT NULL,
  slot_time TIME WITHOUT TIME ZONE NOT NULL,
  available BOOLEAN NOT NULL DEFAULT TRUE,
  shubh BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB DEFAULT ''::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pandit_id, slot_date, slot_time)
);

DROP TRIGGER IF EXISTS set_timestamp_timeslots ON timeslots;
CREATE TRIGGER set_timestamp_timeslots
BEFORE UPDATE ON timeslots
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE INDEX IF NOT EXISTS idx_timeslots_pandit_date ON timeslots(pandit_id, slot_date);
CREATE INDEX IF NOT EXISTS idx_timeslots_date_available ON timeslots(slot_date) WHERE available = true;


