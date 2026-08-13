-- add_muhrats_and_referrals.sql
CREATE TABLE IF NOT EXISTS muhrats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  description TEXT,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  discount_percent NUMERIC,
  active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_timestamp_muhrats ON muhrats;
CREATE TRIGGER set_timestamp_muhrats
BEFORE UPDATE ON muhrats
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  signup_reward NUMERIC DEFAULT 25,
  booking_reward NUMERIC DEFAULT 51,
  earnings NUMERIC DEFAULT 0,
  total_earned NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_timestamp_referrals ON referrals;
CREATE TRIGGER set_timestamp_referrals
BEFORE UPDATE ON referrals
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();
