-- add_rls_policies_examples.sql
ALTER TABLE pandits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pandits_select_public" ON pandits
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "pandits_select_owner_or_admin" ON pandits
  FOR SELECT
  USING (user_id = auth.uid()::uuid OR
         (exists (select 1 from users u where u.id = auth.uid()::uuid and u.role = ''admin'')));

CREATE POLICY "pandits_insert_owner" ON pandits
  FOR INSERT
  WITH CHECK (user_id = auth.uid()::uuid);

CREATE POLICY "pandits_update_owner_or_admin" ON pandits
  FOR UPDATE
  USING (user_id = auth.uid()::uuid OR
         (exists (select 1 from users u where u.id = auth.uid()::uuid and u.role = ''admin'')))
  WITH CHECK (user_id = auth.uid()::uuid OR
             (exists (select 1 from users u where u.id = auth.uid()::uuid and u.role = ''admin'')));

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookings_select_owner" ON bookings
  FOR SELECT
  USING (user_id = auth.uid()::uuid);

CREATE POLICY "bookings_insert_owner" ON bookings
  FOR INSERT
  WITH CHECK (user_id = auth.uid()::uuid);

CREATE POLICY "bookings_admin_select_update_delete" ON bookings
  FOR ALL
  USING (exists (select 1 from users u where u.id = auth.uid()::uuid and u.role = ''admin''));

ALTER TABLE timeslots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timeslots_select_public" ON timeslots
  FOR SELECT
  USING (available = true);

CREATE POLICY "timeslots_manage_owner" ON timeslots
  FOR ALL
  USING (pandit_id = (select id from pandits where user_id = auth.uid()::uuid))
  WITH CHECK (pandit_id = (select id from pandits where user_id = auth.uid()::uuid) OR
              (exists (select 1 from users u where u.id = auth.uid()::uuid and u.role = ''admin'')));
