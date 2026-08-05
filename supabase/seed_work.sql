-- Work & Performance seed (ACCY628)
-- Extends existing compliance contracts — do not invent unrelated events.
-- Edge cases: work before approval, unconfirmed near-event deliverable, pending ad hoc.

TRUNCATE public.work_attachments, public.work_time_materials, public.work_completions,
  public.work_exceptions, public.work_assignments, public.contract_deliverables,
  public.work_parties
  RESTART IDENTITY CASCADE;

INSERT INTO public.work_parties (id, display_name, party_type, vendor_org, email) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', 'Maya Chen', 'manager', NULL, 'maya@mainevent.example'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02', 'Jordan Lee', 'crew', NULL, 'jordan@mainevent.example'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03', 'Sam Ortiz', 'crew', NULL, 'sam@mainevent.example'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb04', 'BrightStage AV', 'vendor', 'BrightStage LLC', 'ops@brightstage.example'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb05', 'Floral & Form', 'vendor', 'Floral & Form', 'desk@floralform.example'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb06', 'Alex Rivera', 'crew', NULL, 'alex@mainevent.example'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb07', 'Northstar AP Contact', 'client', 'Northstar Financial Group', 'ap@northstar.example');

-- Year-End Gala (2222…202)
INSERT INTO public.contract_deliverables (id, contract_id, code, title, description, phase, location, scheduled_start, scheduled_end, status, sort_order) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccc01', '22222222-2222-2222-2222-222222222202', 'YEG-PLAN-SITE', 'Site walkthrough & floor plan', 'Confirm ballroom layout vs contract rider', 'planning', 'Grand Ballroom', '2026-08-10 14:00:00+00', '2026-08-10 17:00:00+00', 'completed', 1),
  ('cccccccc-cccc-cccc-cccc-cccccccccc02', '22222222-2222-2222-2222-222222222202', 'YEG-PLAN-AV', 'AV package confirm', 'Confirm screens, mics, and recording per SOW', 'planning', 'Grand Ballroom', '2026-08-12 10:00:00+00', '2026-08-12 12:00:00+00', 'scheduled', 2),
  ('cccccccc-cccc-cccc-cccc-cccccccccc03', '22222222-2222-2222-2222-222222222202', 'YEG-EXEC-LOAD', 'Load-in & stage build', 'Crew load-in; stage + lighting hung before doors', 'execution', 'Loading dock / Ballroom', '2026-08-08 08:00:00+00', '2026-08-08 14:00:00+00', 'scheduled', 3),
  ('cccccccc-cccc-cccc-cccc-cccccccccc04', '22222222-2222-2222-2222-222222222202', 'YEG-EXEC-SHOW', 'Show-call run of show', 'Live cue sheet execution through last speech', 'execution', 'Grand Ballroom', '2026-08-08 16:00:00+00', '2026-08-08 23:00:00+00', 'promised', 4),
  ('cccccccc-cccc-cccc-cccc-cccccccccc05', '22222222-2222-2222-2222-222222222202', 'YEG-WRAP-STRIKE', 'Strike & inventory return', 'Strike, inventory check-in, venue walk', 'wrapup', 'Grand Ballroom', '2026-08-09 00:30:00+00', '2026-08-09 04:00:00+00', 'promised', 5);

-- Product Launch Experience (2222…204)
INSERT INTO public.contract_deliverables (id, contract_id, code, title, description, phase, location, scheduled_start, scheduled_end, status, sort_order) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccc11', '22222222-2222-2222-2222-222222222204', 'PLE-PLAN-BRIEF', 'Creative brief lock', 'Lock messaging and demo stations', 'planning', 'Summit HQ', '2026-08-01 09:00:00+00', '2026-08-01 11:00:00+00', 'completed', 1),
  ('cccccccc-cccc-cccc-cccc-cccccccccc12', '22222222-2222-2222-2222-222222222204', 'PLE-EXEC-DEMO', 'Demo floor staffing', 'Staff product demo stations during launch window', 'execution', 'Summit Lab Floor', '2026-08-20 12:00:00+00', '2026-08-20 20:00:00+00', 'scheduled', 2),
  ('cccccccc-cccc-cccc-cccc-cccccccccc13', '22222222-2222-2222-2222-222222222204', 'PLE-WRAP-REPORT', 'Post-event attendance wrap', 'Reconcile attendance vs contracted stations', 'wrapup', 'Remote', '2026-08-21 10:00:00+00', '2026-08-21 12:00:00+00', 'promised', 3);

-- Riverfront Charity Ball (2222…206) — near-event unconfirmed deliverable (risk)
INSERT INTO public.contract_deliverables (id, contract_id, code, title, description, phase, location, scheduled_start, scheduled_end, status, sort_order) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccc21', '22222222-2222-2222-2222-222222222206', 'RCB-PLAN-CATER', 'Catering coordination', 'Confirm plated dinner count with venue', 'planning', 'Riverfront Pavilion',
    ((CURRENT_DATE + 1)::text || ' 10:00:00+00')::timestamptz,
    ((CURRENT_DATE + 1)::text || ' 12:00:00+00')::timestamptz,
    'promised', 1),
  ('cccccccc-cccc-cccc-cccc-cccccccccc22', '22222222-2222-2222-2222-222222222206', 'RCB-EXEC-DOOR', 'Door & registration', 'Guest list check-in and badge print', 'execution', 'Pavilion lobby',
    ((CURRENT_DATE + 3)::text || ' 17:00:00+00')::timestamptz,
    ((CURRENT_DATE + 3)::text || ' 19:00:00+00')::timestamptz,
    'scheduled', 2),
  ('cccccccc-cccc-cccc-cccc-cccccccccc23', '22222222-2222-2222-2222-222222222206', 'RCB-EXEC-FLORAL', 'Floral install', 'Centerpieces and stage florals per rider', 'execution', 'Pavilion ballroom',
    ((CURRENT_DATE + 3)::text || ' 10:00:00+00')::timestamptz,
    ((CURRENT_DATE + 3)::text || ' 15:00:00+00')::timestamptz,
    'scheduled', 3),
  ('cccccccc-cccc-cccc-cccc-cccccccccc24', '22222222-2222-2222-2222-222222222206', 'RCB-WRAP-PHOTOS', 'Photo package delivery', 'Deliver edited gallery link to client', 'wrapup', 'Remote',
    ((CURRENT_DATE + 5)::text || ' 09:00:00+00')::timestamptz,
    ((CURRENT_DATE + 5)::text || ' 17:00:00+00')::timestamptz,
    'promised', 4);

INSERT INTO public.work_assignments (id, contract_id, deliverable_id, assignee_party_id, title, instructions, location, scheduled_start, scheduled_end, status) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddd01', '22222222-2222-2222-2222-222222222202', 'cccccccc-cccc-cccc-cccc-cccccccccc01', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02', 'Complete site walkthrough', 'Photograph power drops and mark cable paths', 'Grand Ballroom', '2026-08-10 14:00:00+00', '2026-08-10 17:00:00+00', 'completed'),
  ('dddddddd-dddd-dddd-dddd-dddddddddd02', '22222222-2222-2222-2222-222222222202', 'cccccccc-cccc-cccc-cccc-cccccccccc02', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb04', 'Confirm AV package on site', 'Verify 2x LED walls + 6 wireless mics against SOW', 'Grand Ballroom', '2026-08-12 10:00:00+00', '2026-08-12 12:00:00+00', 'scheduled'),
  ('dddddddd-dddd-dddd-dddd-dddddddddd03', '22222222-2222-2222-2222-222222222202', 'cccccccc-cccc-cccc-cccc-cccccccccc03', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03', 'Lead load-in crew', 'Check in at dock; radio channel 3', 'Loading dock', '2026-08-08 08:00:00+00', '2026-08-08 14:00:00+00', 'scheduled'),
  ('dddddddd-dddd-dddd-dddd-dddddddddd04', '22222222-2222-2222-2222-222222222204', 'cccccccc-cccc-cccc-cccc-cccccccccc12', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb06', 'Staff demo station A', 'Demo tablet + headset; escalate outages to Maya', 'Summit Lab Floor', '2026-08-20 12:00:00+00', '2026-08-20 20:00:00+00', 'checked_in'),
  ('dddddddd-dddd-dddd-dddd-dddddddddd05', '22222222-2222-2222-2222-222222222206', 'cccccccc-cccc-cccc-cccc-cccccccccc23', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb05', 'Install centerpieces', '24 tables + stage piece; photo each completed table', 'Pavilion ballroom',
    ((CURRENT_DATE + 3)::text || ' 10:00:00+00')::timestamptz,
    ((CURRENT_DATE + 3)::text || ' 15:00:00+00')::timestamptz,
    'scheduled'),
  ('dddddddd-dddd-dddd-dddd-dddddddddd06', '22222222-2222-2222-2222-222222222206', 'cccccccc-cccc-cccc-cccc-cccccccccc22', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02', 'Run registration desk', 'Badge printer + guest list tablet', 'Pavilion lobby',
    ((CURRENT_DATE + 3)::text || ' 17:00:00+00')::timestamptz,
    ((CURRENT_DATE + 3)::text || ' 19:00:00+00')::timestamptz,
    'scheduled');

INSERT INTO public.work_completions (id, assignment_id, performed_by_party_id, checked_in_at, completed_at, work_notes, completed_before_approval) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', 'dddddddd-dddd-dddd-dddd-dddddddddd01', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02', '2026-08-10 14:05:00+00', '2026-08-10 16:40:00+00', 'Floor plan signed; two additional power drops needed near stage left.', false),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', 'dddddddd-dddd-dddd-dddd-dddddddddd04', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb06', '2026-08-20 11:55:00+00', NULL, 'Checked in early; awaiting manager sign-off on overtime coverage.', true);

INSERT INTO public.work_time_materials (id, assignment_id, entry_type, description, quantity, unit_label, unit_cost, hours, notes, recorded_by_party_id) VALUES
  ('ffffffff-ffff-ffff-ffff-ffffffffff01', 'dddddddd-dddd-dddd-dddd-dddddddddd01', 'time', 'Site walk labor', 1, 'hours', 65, 2.5, NULL, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02'),
  ('ffffffff-ffff-ffff-ffff-ffffffffff02', 'dddddddd-dddd-dddd-dddd-dddddddddd04', 'materials', 'Demo headset spare', 2, 'units', 45, NULL, 'Brought spares from warehouse', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb06'),
  ('ffffffff-ffff-ffff-ffff-ffffffffff03', 'dddddddd-dddd-dddd-dddd-dddddddddd05', 'cost', 'Rush floral cooler rental', 1, 'day', 180, NULL, 'Unplanned — will file exception', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb05');

INSERT INTO public.work_exceptions (id, contract_id, assignment_id, exception_type, description, submitted_by_party_id, approver_party_id, status, billable_eligible, estimated_amount, resolution_notes, approved_at) VALUES
  ('99999999-9999-9999-9999-999999999901', '22222222-2222-2222-2222-222222222206', 'dddddddd-dddd-dddd-dddd-dddddddddd05', 'scope_addition', 'Client requested 8 additional centerpieces on-site (not in SOW). Flagged for approval before treating as billable.', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb05', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', 'pending_approval', false, 960, NULL, NULL),
  ('99999999-9999-9999-9999-999999999902', '22222222-2222-2222-2222-222222222202', 'dddddddd-dddd-dddd-dddd-dddddddddd02', 'vendor_noshow', 'Backup lighting tech no-show at AV confirm; BrightStage covered with overtime.', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb04', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', 'approved', true, 450, 'Approved OT coverage — Billing may invoice when ready.', '2026-08-04 18:00:00+00'),
  ('99999999-9999-9999-9999-999999999903', '22222222-2222-2222-2222-222222222204', 'dddddddd-dddd-dddd-dddd-dddddddddd04', 'problem', 'Demo tablet network drop for 20 minutes; resolved with tether.', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb06', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', 'rejected', false, 0, 'Internal issue — not billable to client.', '2026-08-20 15:00:00+00');

INSERT INTO public.work_attachments (id, assignment_id, exception_id, file_name, storage_path, external_url, content_type, uploaded_by_party_id) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa11', 'dddddddd-dddd-dddd-dddd-dddddddddd01', NULL, 'site-walk-floorplan.jpg', NULL, 'https://example.com/demo/yeg-floorplan.jpg', 'image/jpeg', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa12', NULL, '99999999-9999-9999-9999-999999999901', 'extra-centerpieces-photo.jpg', NULL, 'https://example.com/demo/rcb-extra-florals.jpg', 'image/jpeg', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb05');
