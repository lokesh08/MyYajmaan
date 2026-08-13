-- seed_timeslots_example.sql
WITH p AS (
  SELECT id AS pandit_id FROM pandits ORDER BY created_at LIMIT 3
), dates AS (
  SELECT (current_date + offs)::date AS d FROM (VALUES (0),(1),(2)) AS t(offs)
), times AS (
  SELECT time ''09:00'' AS t UNION ALL SELECT time ''11:00'' UNION ALL SELECT time ''15:00'' UNION ALL SELECT time ''18:00''
)
INSERT INTO timeslots (pandit_id, slot_date, slot_time, available, shubh, metadata)
SELECT p.pandit_id, d, t, true, false, ''::jsonb
FROM p CROSS JOIN dates d CROSS JOIN times t
ON CONFLICT (pandit_id, slot_date, slot_time) DO NOTHING;


