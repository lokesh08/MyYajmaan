-- public.bookings was originally created by 001_create_booking_tables.sql,
-- which has no updated_at column. A later migration's "CREATE TABLE IF
-- NOT EXISTS bookings (... updated_at ...)" silently no-opped against
-- the already-existing table, but its "CREATE TRIGGER set_timestamp_bookings
-- BEFORE UPDATE ... SET NEW.updated_at = now()" still got attached to the
-- real table regardless — so every UPDATE to any bookings row has been
-- failing with "record \"new\" has no field \"updated_at\"" ever since.
-- Found while testing the Pandit Ji Portal's booking accept/decline flow.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

NOTIFY pgrst, 'reload schema';
