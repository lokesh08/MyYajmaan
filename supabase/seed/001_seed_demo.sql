insert into public.pandits (name, languages, experience, rating, price, approved)
values
  ('Pandit Rajesh Sharma', array['Hindi','English'], 12, 4.9, 2100, true),
  ('Pandit Vivek Mishra', array['Hindi'], 9, 4.8, 1800, true),
  ('Pandit Dinesh Pathak', array['Hindi','Sanskrit'], 15, 4.7, 2500, true),
  ('Pandit Gaurav Joshi', array['Hindi','English'], 7, 4.6, 1600, true)
on conflict do nothing;

insert into public.availability (puja_id, date, timeslot, time, available, shubh)
values
  (1, current_date, '06:00 AM', '06:00 AM', true, false),
  (1, current_date, '07:00 AM', '07:00 AM', true, true),
  (1, current_date, '12:00 PM', '12:00 PM', true, false),
  (1, current_date, '06:00 PM', '06:00 PM', true, false)
on conflict do nothing;
