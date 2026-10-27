-- 1) Expand the cities list to cover all major Indian cities per
--    state/UT (previously only 1-4 per state), so State -> City
--    dropdowns (customer addresses, Pandit Ji signup) are actually
--    useful. Idempotent via the existing UNIQUE(name, state).
INSERT INTO public.cities (name, state) VALUES
  ('Visakhapatnam', 'Andhra Pradesh'), ('Vijayawada', 'Andhra Pradesh'), ('Guntur', 'Andhra Pradesh'),
  ('Nellore', 'Andhra Pradesh'), ('Kurnool', 'Andhra Pradesh'), ('Tirupati', 'Andhra Pradesh'),
  ('Rajahmundry', 'Andhra Pradesh'), ('Kakinada', 'Andhra Pradesh'), ('Anantapur', 'Andhra Pradesh'),

  ('Itanagar', 'Arunachal Pradesh'),

  ('Guwahati', 'Assam'), ('Silchar', 'Assam'), ('Dibrugarh', 'Assam'), ('Jorhat', 'Assam'), ('Tezpur', 'Assam'),
  ('Nagaon', 'Assam'),

  ('Patna', 'Bihar'), ('Gaya', 'Bihar'), ('Bhagalpur', 'Bihar'), ('Muzaffarpur', 'Bihar'),
  ('Darbhanga', 'Bihar'), ('Purnia', 'Bihar'), ('Arrah', 'Bihar'),

  ('Chandigarh', 'Chandigarh'),

  ('Raipur', 'Chhattisgarh'), ('Bhilai', 'Chhattisgarh'), ('Bilaspur', 'Chhattisgarh'),
  ('Durg', 'Chhattisgarh'), ('Korba', 'Chhattisgarh'), ('Raigarh', 'Chhattisgarh'),

  ('Panaji', 'Goa'), ('Margao', 'Goa'), ('Vasco da Gama', 'Goa'), ('Mapusa', 'Goa'),

  ('Ahmedabad', 'Gujarat'), ('Surat', 'Gujarat'), ('Vadodara', 'Gujarat'), ('Rajkot', 'Gujarat'),
  ('Bhavnagar', 'Gujarat'), ('Jamnagar', 'Gujarat'), ('Gandhinagar', 'Gujarat'), ('Anand', 'Gujarat'),
  ('Junagadh', 'Gujarat'), ('Nadiad', 'Gujarat'),

  ('Gurugram', 'Haryana'), ('Faridabad', 'Haryana'), ('Panipat', 'Haryana'), ('Ambala', 'Haryana'),
  ('Hisar', 'Haryana'), ('Karnal', 'Haryana'), ('Rohtak', 'Haryana'), ('Panchkula', 'Haryana'),
  ('Sonipat', 'Haryana'), ('Yamunanagar', 'Haryana'),

  ('Shimla', 'Himachal Pradesh'), ('Manali', 'Himachal Pradesh'), ('Dharamshala', 'Himachal Pradesh'),
  ('Solan', 'Himachal Pradesh'), ('Mandi', 'Himachal Pradesh'),

  ('Jammu', 'Jammu and Kashmir'), ('Srinagar', 'Jammu and Kashmir'), ('Anantnag', 'Jammu and Kashmir'),
  ('Baramulla', 'Jammu and Kashmir'),

  ('Ranchi', 'Jharkhand'), ('Jamshedpur', 'Jharkhand'), ('Dhanbad', 'Jharkhand'),
  ('Bokaro', 'Jharkhand'), ('Hazaribagh', 'Jharkhand'), ('Deoghar', 'Jharkhand'),

  ('Bengaluru', 'Karnataka'), ('Mysuru', 'Karnataka'), ('Mangaluru', 'Karnataka'), ('Hubballi', 'Karnataka'),
  ('Belagavi', 'Karnataka'), ('Davanagere', 'Karnataka'), ('Shivamogga', 'Karnataka'),
  ('Tumakuru', 'Karnataka'), ('Ballari', 'Karnataka'), ('Udupi', 'Karnataka'),

  ('Thiruvananthapuram', 'Kerala'), ('Kochi', 'Kerala'), ('Kozhikode', 'Kerala'), ('Thrissur', 'Kerala'),
  ('Kollam', 'Kerala'), ('Kannur', 'Kerala'), ('Alappuzha', 'Kerala'), ('Kottayam', 'Kerala'), ('Palakkad', 'Kerala'),

  ('Bhopal', 'Madhya Pradesh'), ('Indore', 'Madhya Pradesh'), ('Jabalpur', 'Madhya Pradesh'),
  ('Gwalior', 'Madhya Pradesh'), ('Ujjain', 'Madhya Pradesh'), ('Sagar', 'Madhya Pradesh'),
  ('Satna', 'Madhya Pradesh'), ('Rewa', 'Madhya Pradesh'), ('Dewas', 'Madhya Pradesh'),

  ('Mumbai', 'Maharashtra'), ('Pune', 'Maharashtra'), ('Nagpur', 'Maharashtra'), ('Nashik', 'Maharashtra'),
  ('Aurangabad', 'Maharashtra'), ('Solapur', 'Maharashtra'), ('Kolhapur', 'Maharashtra'),
  ('Thane', 'Maharashtra'), ('Amravati', 'Maharashtra'), ('Navi Mumbai', 'Maharashtra'),
  ('Nanded', 'Maharashtra'), ('Sangli', 'Maharashtra'), ('Akola', 'Maharashtra'),

  ('Imphal', 'Manipur'),
  ('Shillong', 'Meghalaya'),
  ('Aizawl', 'Mizoram'),
  ('Kohima', 'Nagaland'), ('Dimapur', 'Nagaland'),

  ('Bhubaneswar', 'Odisha'), ('Cuttack', 'Odisha'), ('Rourkela', 'Odisha'),
  ('Berhampur', 'Odisha'), ('Puri', 'Odisha'), ('Sambalpur', 'Odisha'),

  ('Amritsar', 'Punjab'), ('Ludhiana', 'Punjab'), ('Jalandhar', 'Punjab'), ('Patiala', 'Punjab'),
  ('Bathinda', 'Punjab'), ('Mohali', 'Punjab'), ('Hoshiarpur', 'Punjab'),

  ('Jaipur', 'Rajasthan'), ('Jodhpur', 'Rajasthan'), ('Udaipur', 'Rajasthan'), ('Kota', 'Rajasthan'),
  ('Ajmer', 'Rajasthan'), ('Bikaner', 'Rajasthan'), ('Alwar', 'Rajasthan'), ('Bhilwara', 'Rajasthan'),
  ('Sikar', 'Rajasthan'), ('Pushkar', 'Rajasthan'),

  ('Gangtok', 'Sikkim'),

  ('Chennai', 'Tamil Nadu'), ('Coimbatore', 'Tamil Nadu'), ('Madurai', 'Tamil Nadu'),
  ('Tiruchirappalli', 'Tamil Nadu'), ('Salem', 'Tamil Nadu'), ('Tirunelveli', 'Tamil Nadu'),
  ('Erode', 'Tamil Nadu'), ('Vellore', 'Tamil Nadu'), ('Thanjavur', 'Tamil Nadu'), ('Tiruppur', 'Tamil Nadu'),

  ('Hyderabad', 'Telangana'), ('Warangal', 'Telangana'), ('Nizamabad', 'Telangana'),
  ('Karimnagar', 'Telangana'), ('Khammam', 'Telangana'), ('Secunderabad', 'Telangana'),

  ('Agartala', 'Tripura'),

  ('Lucknow', 'Uttar Pradesh'), ('Kanpur', 'Uttar Pradesh'), ('Varanasi', 'Uttar Pradesh'),
  ('Agra', 'Uttar Pradesh'), ('Prayagraj', 'Uttar Pradesh'), ('Ghaziabad', 'Uttar Pradesh'),
  ('Noida', 'Uttar Pradesh'), ('Meerut', 'Uttar Pradesh'), ('Bareilly', 'Uttar Pradesh'),
  ('Aligarh', 'Uttar Pradesh'), ('Gorakhpur', 'Uttar Pradesh'), ('Mathura', 'Uttar Pradesh'),
  ('Ayodhya', 'Uttar Pradesh'), ('Moradabad', 'Uttar Pradesh'), ('Jhansi', 'Uttar Pradesh'),

  ('Dehradun', 'Uttarakhand'), ('Haridwar', 'Uttarakhand'), ('Rishikesh', 'Uttarakhand'),
  ('Nainital', 'Uttarakhand'), ('Haldwani', 'Uttarakhand'), ('Roorkee', 'Uttarakhand'),

  ('Kolkata', 'West Bengal'), ('Howrah', 'West Bengal'), ('Durgapur', 'West Bengal'),
  ('Asansol', 'West Bengal'), ('Siliguri', 'West Bengal'), ('Kharagpur', 'West Bengal'),

  ('New Delhi', 'Delhi'), ('Dwarka', 'Delhi'), ('Rohini', 'Delhi'),

  ('Leh', 'Ladakh'),
  ('Puducherry', 'Puducherry'),
  ('Port Blair', 'Andaman and Nicobar Islands'),
  ('Daman', 'Dadra and Nagar Haveli and Daman and Diu'),
  ('Kavaratti', 'Lakshadweep')
ON CONFLICT (name, state) DO NOTHING;

-- 2) Pandit Ji signup will now collect State + City as two dropdowns
--    (previously only city, combined free-text with state in the label).
ALTER TABLE public.pandits
  ADD COLUMN IF NOT EXISTS state TEXT;

-- 3) Signup (both customer and Pandit Ji) now requires agreeing to the
--    Privacy Policy / Terms and Conditions. Recorded with a timestamp
--    for an actual compliance record, not just a boolean flag.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
