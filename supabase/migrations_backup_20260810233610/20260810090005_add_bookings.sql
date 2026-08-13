-- add_bookings.sql
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  puja_id UUID,
  pandit_id UUID,
  package_id UUID,
  date DATE,
  timeslot TEXT,
  amount NUMERIC,
  payment_ref TEXT,
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_timestamp_bookings ON bookings;
CREATE TRIGGER set_timestamp_bookings
BEFORE UPDATE ON bookings
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();
