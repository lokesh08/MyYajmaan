-- Two festivals found missing from the Hindu calendar coverage,
-- mapped to the newly uploaded images in public/images/festivals/.
-- Dates verified against Drik Panchang for the 2026-2027 window this
-- table already covers.

INSERT INTO festivals (title, description, start_date, image_url, highlight)
VALUES
  (
    'Dattatreya Jayanti',
    'Celebrates the birth of Lord Dattatreya, the combined avatar of Brahma, Vishnu and Shiva, observed on Margashirsha Purnima.',
    '2026-12-23',
    '/images/festivals/DattaJayanti.png',
    FALSE
  ),
  (
    'Gudi Padwa',
    'Marks the Marathi and Konkani New Year with the raising of the Gudi, a decorated flag, outside homes on Chaitra Shukla Pratipada.',
    '2027-04-07',
    '/images/festivals/GudiPadwa.png',
    FALSE
  );

NOTIFY pgrst, 'reload schema';
