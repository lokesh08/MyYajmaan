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
  (''Diwali'', ''Festival of lights â€” auspicious time for house pujas and rituals'', date_trunc(''day'', now())::date + INTERVAL ''45 day'', NULL, NULL, TRUE),
  (''Navaratri'', ''Nine nights festival dedicated to Durga'', date_trunc(''day'', now())::date + INTERVAL ''120 day'', date_trunc(''day'', now())::date + INTERVAL ''129 day'', NULL, FALSE),
  (''Makar Sankranti'', ''Harvest festival and holy dips'', date_trunc(''day'', now())::date + INTERVAL ''200 day'', NULL, NULL, FALSE)
ON CONFLICT (title) DO NOTHING;
