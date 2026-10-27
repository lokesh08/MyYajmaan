-- Replaces the festivals table content with the major Hindu festivals
-- from Aug 2026 through Aug 2027, mapped to the images uploaded under
-- public/images/festivals/. Festivals without a dedicated uploaded
-- image fall back to the app's existing generic fallback image.
--
-- Dates are sourced from published 2026/2027 Hindu panchang calendars
-- and are for the North Indian / pan-India observance where regional
-- variation exists.

DELETE FROM public.festivals;

INSERT INTO public.festivals (title, description, start_date, end_date, image_url, highlight)
VALUES
  ('Raksha Bandhan', 'Sisters tie a rakhi on their brothers'' wrists, celebrating the bond of protection and love.', '2026-08-28', NULL, '/images/booking-fallback.svg', TRUE),
  ('Krishna Janmashtami', 'Marks the birth of Lord Krishna with midnight aarti, fasting, and Dahi Handi celebrations.', '2026-09-04', NULL, '/images/festivals/Janamashtmi.png', TRUE),
  ('Ganesh Chaturthi', 'A ten-day festival welcoming Lord Ganesha into homes with daily puja, ending on Anant Chaturdashi.', '2026-09-14', '2026-09-25', '/images/festivals/GaneshChaturthi.png', TRUE),
  ('Anant Chaturdashi', 'The final day of Ganeshotsav, when Lord Ganesha''s idol is immersed (Ganesh Visarjan) with grand processions.', '2026-09-25', NULL, '/images/festivals/AnantChaturdashi.png', FALSE),
  ('Sharad Navratri', 'Nine nights of worshipping the nine forms of Goddess Durga, celebrated with fasting, garba and dandiya.', '2026-10-11', '2026-10-19', '/images/festivals/Navratra.png', TRUE),
  ('Dussehra', 'Vijayadashami marks the victory of good over evil, celebrated with Ravana Dahan and Durga idol immersion.', '2026-10-20', NULL, '/images/festivals/Dusseshra.png', TRUE),
  ('Karva Chauth', 'Married women observe a day-long fast for their husbands'' long life, breaking it after sighting the moon.', '2026-10-29', NULL, '/images/festivals/KarwaChauth.png', FALSE),
  ('Dhanteras', 'The first day of the Diwali festivities, marked by buying gold, silver and new utensils for prosperity.', '2026-11-06', NULL, '/images/festivals/Dhanteres.png', TRUE),
  ('Diwali', 'The festival of lights celebrating the return of Lord Rama to Ayodhya, marked with diyas, rangoli and Lakshmi Puja.', '2026-11-08', NULL, '/images/festivals/Diwali.png', TRUE),
  ('Govardhan Puja', 'Commemorates Lord Krishna lifting the Govardhan hill to protect villagers, observed the day after Diwali.', '2026-11-10', NULL, '/images/booking-fallback.svg', FALSE),
  ('Bhai Dooj', 'Celebrates the bond between brothers and sisters with tilak rituals and an exchange of gifts.', '2026-11-11', NULL, '/images/booking-fallback.svg', FALSE),
  ('Chhath Puja', 'A rigorous four-day festival dedicated to the Sun God, observed mainly in Bihar, Jharkhand and UP.', '2026-11-15', NULL, '/images/booking-fallback.svg', FALSE),
  ('Makar Sankranti', 'Marks the sun''s transition into Capricorn and the start of longer days, celebrated with kite flying and til-gud.', '2027-01-14', NULL, '/images/booking-fallback.svg', FALSE),
  ('Vasant Panchami', 'Honours Goddess Saraswati, the deity of knowledge and the arts, marking the onset of spring.', '2027-02-11', NULL, '/images/booking-fallback.svg', FALSE),
  ('Maha Shivratri', 'A night of fasting and prayer dedicated to Lord Shiva, observed with Rudrabhishek and jagran.', '2027-03-06', NULL, '/images/booking-fallback.svg', FALSE),
  ('Holi', 'The festival of colours celebrating the arrival of spring, preceded by Holika Dahan the night before.', '2027-03-22', NULL, '/images/booking-fallback.svg', TRUE),
  ('Ram Navami', 'Celebrates the birth of Lord Rama with recitations of the Ramayana and temple processions.', '2027-04-15', NULL, '/images/festivals/RamNavami.png', TRUE),
  ('Hanuman Jayanti', 'Marks the birth of Lord Hanuman, celebrated with prayers, processions and readings of the Hanuman Chalisa.', '2027-04-20', NULL, '/images/booking-fallback.svg', FALSE),
  ('Akshaya Tritiya', 'An auspicious day for new beginnings, considered ideal for buying gold and starting new ventures.', '2027-05-09', NULL, '/images/booking-fallback.svg', FALSE),
  ('Guru Purnima', 'A day to honour teachers and spiritual guides, observed with puja and gratitude towards one''s guru.', '2027-07-18', NULL, '/images/booking-fallback.svg', TRUE),
  ('Raksha Bandhan', 'Sisters tie a rakhi on their brothers'' wrists, celebrating the bond of protection and love.', '2027-08-17', NULL, '/images/booking-fallback.svg', TRUE)
;
