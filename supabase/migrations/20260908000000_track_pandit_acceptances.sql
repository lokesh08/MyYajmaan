-- booking_assignment_events previously only recorded declines and
-- reassignments -- adding 'pandit_accepted' means a pandit's full
-- accept/decline history is one ordered query away, independent of
-- bookings.pandit_id (which gets overwritten on reassignment), which is
-- what makes both a durable "Declined" view and a consecutive-decline
-- streak computable.
ALTER TABLE public.booking_assignment_events DROP CONSTRAINT booking_assignment_events_action_check;
ALTER TABLE public.booking_assignment_events ADD CONSTRAINT booking_assignment_events_action_check
  CHECK (action IN ('created', 'pandit_declined', 'pandit_accepted', 'admin_reassigned'));

-- Lets admin pick which of a testimonial's uploaded photos represents it
-- on the home page Testimonials carousel.
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS cover_photo_url TEXT;

NOTIFY pgrst, 'reload schema';
