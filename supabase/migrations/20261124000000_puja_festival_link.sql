-- Festival-specific pujas (Holika Dahan, Diwali, Ganesh Chaturthi...) are
-- linked to a festival by NAME, so the link keeps working every year: the
-- booking page looks up the next dated entry with that title in
-- public.festivals and warns if the customer picks a different date.

ALTER TABLE public.pujas
  ADD COLUMN IF NOT EXISTS festival_name TEXT;

-- The Aug 2026 - Aug 2027 festival seed ended up applied twice on some
-- databases; keep one row per (title, start_date).
DELETE FROM public.festivals a
USING public.festivals b
WHERE a.title = b.title
  AND a.start_date = b.start_date
  AND a.ctid > b.ctid;

-- Holika Dahan is the evening before Holi (22 Mar 2027).
INSERT INTO public.festivals (title, description, start_date, end_date, image_url, highlight)
SELECT 'Holika Dahan', 'The bonfire on the eve of Holi, marking the victory of good over evil.', DATE '2027-03-21', NULL, NULL, FALSE
WHERE NOT EXISTS (
  SELECT 1 FROM public.festivals WHERE title = 'Holika Dahan' AND start_date = DATE '2027-03-21'
);

-- Pre-link the obvious festival pujas (only where not set already, so
-- re-running never overrides a choice made in Admin -> Pujas).
UPDATE public.pujas p
SET festival_name = m.festival
FROM (VALUES
  ('Holika Dahan Puja', 'Holika Dahan'),
  ('Ganesh Chaturthi Puja', 'Ganesh Chaturthi'),
  ('Lakshmi Puja (Diwali)', 'Diwali'),
  ('Diwali Lakshmi-Ganesh Puja', 'Diwali'),
  ('Dhanteras Puja', 'Dhanteras'),
  ('Durga Puja (Navratri)', 'Sharad Navratri'),
  ('Chhath Puja', 'Chhath Puja'),
  ('Karva Chauth Puja', 'Karva Chauth'),
  ('Raksha Bandhan Puja', 'Raksha Bandhan'),
  ('Ram Navami Puja', 'Ram Navami'),
  ('Makar Sankranti Puja', 'Makar Sankranti')
) AS m(puja_title, festival)
WHERE p.title = m.puja_title
  AND p.festival_name IS NULL;
