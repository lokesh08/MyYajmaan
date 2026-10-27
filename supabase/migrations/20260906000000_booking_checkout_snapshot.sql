-- The checkout flow (BookAddress.jsx / BookPayment.jsx) has always
-- collected the delivery address, a contact name/phone, a special-
-- instructions note, and the chosen payment method -- but createBooking()
-- never sent any of it, so bookings had nothing to show for it. Snapshot
-- these onto the booking row itself (not just address_id) so admin can
-- always see exactly what was used at booking time, even if the customer
-- later edits or deletes the saved address it came from.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS address_line TEXT,
  ADD COLUMN IF NOT EXISTS address_city TEXT,
  ADD COLUMN IF NOT EXISTS address_state TEXT,
  ADD COLUMN IF NOT EXISTS address_pincode TEXT,
  ADD COLUMN IF NOT EXISTS special_instructions TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT;

NOTIFY pgrst, 'reload schema';
