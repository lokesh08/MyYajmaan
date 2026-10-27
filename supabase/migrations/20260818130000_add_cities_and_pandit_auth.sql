CREATE TABLE IF NOT EXISTS public.cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(name, state)
);

INSERT INTO public.cities (name, state) VALUES
  ('Ahmedabad', 'Gujarat'),
  ('Amritsar', 'Punjab'),
  ('Bengaluru', 'Karnataka'),
  ('Bhopal', 'Madhya Pradesh'),
  ('Bhubaneswar', 'Odisha'),
  ('Chandigarh', 'Chandigarh'),
  ('Chennai', 'Tamil Nadu'),
  ('Coimbatore', 'Tamil Nadu'),
  ('Dehradun', 'Uttarakhand'),
  ('Delhi', 'Delhi'),
  ('Guwahati', 'Assam'),
  ('Hyderabad', 'Telangana'),
  ('Indore', 'Madhya Pradesh'),
  ('Jaipur', 'Rajasthan'),
  ('Jammu', 'Jammu and Kashmir'),
  ('Kanpur', 'Uttar Pradesh'),
  ('Kochi', 'Kerala'),
  ('Kolkata', 'West Bengal'),
  ('Lucknow', 'Uttar Pradesh'),
  ('Ludhiana', 'Punjab'),
  ('Madurai', 'Tamil Nadu'),
  ('Mumbai', 'Maharashtra'),
  ('Mysuru', 'Karnataka'),
  ('Nagpur', 'Maharashtra'),
  ('Nashik', 'Maharashtra'),
  ('Patna', 'Bihar'),
  ('Prayagraj', 'Uttar Pradesh'),
  ('Pune', 'Maharashtra'),
  ('Raipur', 'Chhattisgarh'),
  ('Rajkot', 'Gujarat'),
  ('Ranchi', 'Jharkhand'),
  ('Surat', 'Gujarat'),
  ('Thiruvananthapuram', 'Kerala'),
  ('Udaipur', 'Rajasthan'),
  ('Vadodara', 'Gujarat'),
  ('Varanasi', 'Uttar Pradesh'),
  ('Vijayawada', 'Andhra Pradesh'),
  ('Visakhapatnam', 'Andhra Pradesh')
ON CONFLICT (name, state) DO NOTHING;

GRANT SELECT ON TABLE public.cities TO anon, authenticated, service_role;

ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cities_public_read" ON public.cities;
CREATE POLICY "cities_public_read" ON public.cities
  FOR SELECT USING (true);
