# create_migrations_and_zip.ps1
# Run from your repo root. Creates supabase/migrations/<timestamp>_<name>.sql files and zips them to migrations.zip
# If PowerShell execution policy blocks this script, run:
#   powershell -ExecutionPolicy Bypass -File .\create_migrations_and_zip.ps1

$baseDir = Join-Path (Get-Location) "supabase\migrations"
New-Item -ItemType Directory -Force -Path $baseDir | Out-Null

function Write-MigrationFile($ts, $name, $content) {
  $filename = "${ts}_$name.sql"
  $path = Join-Path $baseDir $filename
  Set-Content -Path $path -Value $content -Encoding UTF8
  Write-Host "Created $path"
}

# Use fixed timestamps (incrementing seconds) to make ordering deterministic.
# You can adjust timestamps if desired.
$tsBase = "202608100900"
$secs = 0
function NextTS() {
  param()
  $global:secs = $global:secs + 1
  return "${tsBase}{0:D2}" -f $global:secs
}

# Migration contents (SQL)
$add_users_and_roles = @'
-- add_users_and_roles.sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('user','pandit','admin');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'user',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login TIMESTAMPTZ
);

CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_users ON users;
CREATE TRIGGER set_timestamp_users
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();
'@

$add_refresh_tokens = @'
-- add_refresh_tokens.sql
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  user_agent TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
'@

$add_audit_logs = @'
-- add_audit_logs.sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity);
'@

$add_muhrats_and_referrals = @'
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
'@

$add_bookings = @'
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
'@

$add_pujas_pandits = @'
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
  metadata JSONB DEFAULT '\''{}'\''::jsonb,
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
  metadata JSONB DEFAULT '\''{}'\''::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_timestamp_pandits ON pandits;
CREATE TRIGGER set_timestamp_pandits
BEFORE UPDATE ON pandits
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE INDEX IF NOT EXISTS idx_pandits_city ON pandits(city);
CREATE INDEX IF NOT EXISTS idx_pandits_is_active ON pandits(is_active);
'@

$add_pandit_puja_relation = @'
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
'@

$add_festivals = @'
-- add_festivals.sql
CREATE TABLE IF NOT EXISTS festivals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  image_url TEXT,
  highlight BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '\''{}'\''::jsonb,
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
'@

$seed_pujas_pandits_festivals = @'
-- seed_pujas_pandits_festivals.sql
INSERT INTO pujas (code, title, description, duration_minutes, base_price, category, shubh_available)
VALUES
  (''GRAH_SHANTI'', ''Grah Shanti'', ''Home Grah Shanti ritual for peace & prosperity'', 90, 1200, ''home'', true),
  (''SATYANARAYAN'', ''Satyanarayan Puja'', ''Satyanarayan puja for good fortune'', 75, 1000, ''home'', true),
  (''HOMA'', ''Homa / Yajna'', ''Small havan / homa for blessings'', 60, 1500, ''ceremony'', false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO users (email, password_hash, full_name, role, created_at)
VALUES
  (''pandit1@local.test'', crypt(''panditpass'', gen_salt(''bf'')), ''Pandit Rajesh Sharma'', ''pandit'', now())
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (email, password_hash, full_name, role, created_at)
VALUES
  (''pandit2@local.test'', crypt(''panditpass'', gen_salt(''bf'')), ''Pandit Vivek Mishra'', ''pandit'', now())
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (email, password_hash, full_name, role, created_at)
VALUES
  (''pandit3@local.test'', crypt(''panditpass'', gen_salt(''bf'')), ''Pandit Dinesh Pathak'', ''pandit'', now())
ON CONFLICT (email) DO NOTHING;

INSERT INTO pandits (user_id, display_name, languages, experience_years, rating, price, about, avatar_url, city, address, pin, latitude, longitude)
SELECT u.id, ''Pandit Rajesh Sharma'', ARRAY[''Hindi'',''English''], 12, 4.9, 2100, ''Experienced priest for Grah Shanti and Satyanarayan'', NULL, ''Delhi'', ''Kashmere Gate, Delhi'', ''110006'', 28.66, 77.23
FROM users u WHERE u.email = ''pandit1@local.test''
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO pandits (user_id, display_name, languages, experience_years, rating, price, about, avatar_url, city, address, pin, latitude, longitude)
SELECT u.id, ''Pandit Vivek Mishra'', ARRAY[''Hindi''], 9, 4.8, 1800, ''Honourable pandit with vast experience'', NULL, ''Delhi'', ''Connaught Place, Delhi'', ''110001'', 28.63, 77.21
FROM users u WHERE u.email = ''pandit2@local.test''
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO pandits (user_id, display_name, languages, experience_years, rating, price, about, avatar_url, city, address, pin, latitude, longitude)
SELECT u.id, ''Pandit Dinesh Pathak'', ARRAY[''Hindi'',''Sanskrit''], 15, 4.7, 2500, ''Expert in Vedic rituals and homa'', NULL, ''Delhi'', ''Karol Bagh, Delhi'', ''110005'', 28.65, 77.20
FROM users u WHERE u.email = ''pandit3@local.test''
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO pandit_puja (pandit_id, puja_id, price_override, featured)
SELECT p.id, pu.id, NULL, FALSE
FROM pandits p, pujas pu
WHERE pu.code = ''GRAH_SHANTI'' AND p.display_name ILIKE ''%Rajesh%''
ON CONFLICT (pandit_id, puja_id) DO NOTHING;

INSERT INTO pandit_puja (pandit_id, puja_id, price_override, featured)
SELECT p.id, pu.id, NULL, TRUE
FROM pandits p, pujas pu
WHERE pu.code = ''GRAH_SHANTI'' AND p.display_name ILIKE ''%Vivek%''
ON CONFLICT (pandit_id, puja_id) DO NOTHING;

INSERT INTO pandit_puja (pandit_id, puja_id, price_override, featured)
SELECT p.id, pu.id, 2800, FALSE
FROM pandits p, pujas pu
WHERE pu.code = ''HOMA'' AND p.display_name ILIKE ''%Dinesh%''
ON CONFLICT (pandit_id, puja_id) DO NOTHING;

INSERT INTO festivals (title, description, start_date, end_date, image_url, highlight)
VALUES
  (''Diwali'', ''Festival of lights — auspicious time for house pujas and rituals'', date_trunc(''day'', now())::date + INTERVAL ''45 day'', NULL, NULL, TRUE),
  (''Navaratri'', ''Nine nights festival dedicated to Durga'', date_trunc(''day'', now())::date + INTERVAL ''120 day'', date_trunc(''day'', now())::date + INTERVAL ''129 day'', NULL, FALSE),
  (''Makar Sankranti'', ''Harvest festival and holy dips'', date_trunc(''day'', now())::date + INTERVAL ''200 day'', NULL, NULL, FALSE)
ON CONFLICT (title) DO NOTHING;
'@

$add_timeslots = @'
-- add_timeslots.sql
CREATE TABLE IF NOT EXISTS timeslots (
  id BIGSERIAL PRIMARY KEY,
  pandit_id UUID NOT NULL REFERENCES pandits(id) ON DELETE CASCADE,
  slot_date DATE NOT NULL,
  slot_time TIME WITHOUT TIME ZONE NOT NULL,
  available BOOLEAN NOT NULL DEFAULT TRUE,
  shubh BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB DEFAULT '\''{}'\''::jsonb,
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
'@

$add_search_indexes_and_view = @'
-- add_search_indexes_and_view.sql
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE INDEX IF NOT EXISTS idx_users_metadata_gin ON users USING gin (metadata);
CREATE INDEX IF NOT EXISTS idx_pandits_metadata_gin ON pandits USING gin (metadata);
CREATE INDEX IF NOT EXISTS idx_pujas_metadata_gin ON pujas USING gin (metadata);

CREATE INDEX IF NOT EXISTS idx_pujas_tsv_title_desc ON pujas USING GIN (
  to_tsvector('simple', coalesce(title, '''') || '' '' || coalesce(description, ''''))
);

CREATE INDEX IF NOT EXISTS idx_pujas_title_trgm ON pujas USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_pujas_category_title ON pujas (category)
WHERE category IS NOT NULL;

CREATE OR REPLACE VIEW v_puja_with_pandit_count AS
SELECT
  pu.id,
  pu.code,
  pu.title,
  pu.description,
  pu.category,
  pu.base_price,
  pu.shubh_available,
  pu.metadata,
  COALESCE(count_pp.pandit_count, 0) AS pandit_count,
  COALESCE(min_price.min_price, pu.base_price) AS min_price
FROM pujas pu
LEFT JOIN (
  SELECT puja_id, COUNT(DISTINCT pandit_id) AS pandit_count
  FROM pandit_puja pp
  JOIN pandits p ON p.id = pp.pandit_id AND p.is_active = true
  WHERE pp.active = true
  GROUP BY puja_id
) AS count_pp ON count_pp.puja_id = pu.id
LEFT JOIN (
  SELECT puja_id, MIN(COALESCE(price_override, p.price, pu.base_price)) AS min_price
  FROM pandit_puja pp
  JOIN pandits p ON p.id = pp.pandit_id AND p.is_active = true
  JOIN pujas pu2 ON pu2.id = pp.puja_id
  GROUP BY puja_id
) AS min_price ON min_price.puja_id = pu.id;
'@

$add_rls_policies_examples = @'
-- add_rls_policies_examples.sql
ALTER TABLE pandits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pandits_select_public" ON pandits
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "pandits_select_owner_or_admin" ON pandits
  FOR SELECT
  USING (user_id = auth.uid()::uuid OR
         (exists (select 1 from users u where u.id = auth.uid()::uuid and u.role = ''admin'')));

CREATE POLICY "pandits_insert_owner" ON pandits
  FOR INSERT
  WITH CHECK (user_id = auth.uid()::uuid);

CREATE POLICY "pandits_update_owner_or_admin" ON pandits
  FOR UPDATE
  USING (user_id = auth.uid()::uuid OR
         (exists (select 1 from users u where u.id = auth.uid()::uuid and u.role = ''admin'')))
  WITH CHECK (user_id = auth.uid()::uuid OR
             (exists (select 1 from users u where u.id = auth.uid()::uuid and u.role = ''admin'')));

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookings_select_owner" ON bookings
  FOR SELECT
  USING (user_id = auth.uid()::uuid);

CREATE POLICY "bookings_insert_owner" ON bookings
  FOR INSERT
  WITH CHECK (user_id = auth.uid()::uuid);

CREATE POLICY "bookings_admin_select_update_delete" ON bookings
  FOR ALL
  USING (exists (select 1 from users u where u.id = auth.uid()::uuid and u.role = ''admin''));

ALTER TABLE timeslots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timeslots_select_public" ON timeslots
  FOR SELECT
  USING (available = true);

CREATE POLICY "timeslots_manage_owner" ON timeslots
  FOR ALL
  USING (pandit_id = (select id from pandits where user_id = auth.uid()::uuid))
  WITH CHECK (pandit_id = (select id from pandits where user_id = auth.uid()::uuid) OR
              (exists (select 1 from users u where u.id = auth.uid()::uuid and u.role = ''admin'')));
'@

$seed_timeslots_example = @'
-- seed_timeslots_example.sql
WITH p AS (
  SELECT id AS pandit_id FROM pandits ORDER BY created_at LIMIT 3
), dates AS (
  SELECT (current_date + offs)::date AS d FROM (VALUES (0),(1),(2)) AS t(offs)
), times AS (
  SELECT time ''09:00'' AS t UNION ALL SELECT time ''11:00'' UNION ALL SELECT time ''15:00'' UNION ALL SELECT time ''18:00''
)
INSERT INTO timeslots (pandit_id, slot_date, slot_time, available, shubh, metadata)
SELECT p.pandit_id, d, t, true, false, '\''{}'\''::jsonb
FROM p CROSS JOIN dates d CROSS JOIN times t
ON CONFLICT (pandit_id, slot_date, slot_time) DO NOTHING;
'@

# Write files with incremental timestamps
Write-MigrationFile (NextTS) "add_users_and_roles" $add_users_and_roles
Write-MigrationFile (NextTS) "add_refresh_tokens" $add_refresh_tokens
Write-MigrationFile (NextTS) "add_audit_logs" $add_audit_logs
Write-MigrationFile (NextTS) "add_muhrats_and_referrals" $add_muhrats_and_referrals
Write-MigrationFile (NextTS) "add_bookings" $add_bookings
Write-MigrationFile (NextTS) "add_pujas_pandits" $add_pujas_pandits
Write-MigrationFile (NextTS) "add_pandit_puja_relation" $add_pandit_puja_relation
Write-MigrationFile (NextTS) "add_festivals" $add_festivals
Write-MigrationFile (NextTS) "seed_pujas_pandits_festivals" $seed_pujas_pandits_festivals
Write-MigrationFile (NextTS) "add_timeslots" $add_timeslots
Write-MigrationFile (NextTS) "add_search_indexes_and_view" $add_search_indexes_and_view
Write-MigrationFile (NextTS) "add_rls_policies_examples" $add_rls_policies_examples
Write-MigrationFile (NextTS) "seed_timeslots_example" $seed_timeslots_example

# Zip the migrations folder
$zipPath = Join-Path (Get-Location) "migrations.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path (Join-Path $baseDir "*") -DestinationPath $zipPath
Write-Host "Created $zipPath with all migration files."