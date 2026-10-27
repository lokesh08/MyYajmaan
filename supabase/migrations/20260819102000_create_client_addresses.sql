-- Client address book. Clients may save multiple puja locations.

CREATE TABLE IF NOT EXISTS public.client_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL
    REFERENCES public.users(id)
    ON DELETE CASCADE,
  label TEXT,
  address_line TEXT NOT NULL,
  city TEXT NOT NULL,
  pincode TEXT NOT NULL,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_addresses_latitude_range
    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CONSTRAINT client_addresses_longitude_range
    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

-- A client may keep multiple addresses, but only one can be preselected.
CREATE UNIQUE INDEX IF NOT EXISTS client_addresses_one_default_per_client
  ON public.client_addresses(client_id)
  WHERE is_default;

CREATE INDEX IF NOT EXISTS idx_client_addresses_client_id
  ON public.client_addresses(client_id);

CREATE INDEX IF NOT EXISTS idx_client_addresses_city_pincode
  ON public.client_addresses(city, pincode);

DROP TRIGGER IF EXISTS set_timestamp_client_addresses ON public.client_addresses;
CREATE TRIGGER set_timestamp_client_addresses
BEFORE UPDATE ON public.client_addresses
FOR EACH ROW
EXECUTE PROCEDURE public.trigger_set_timestamp();
