INSERT INTO users (id, firstname, lastname, email, password_hash, role_id, status, approved_by, approved_at) VALUES
  (9001, 'Sample', 'Manager', 'sample.manager@example.test', 'not-a-real-hash', 2, 'approved', NULL, now()),
  (9002, 'Sample', 'Instructor', 'sample.instructor@example.test', 'not-a-real-hash', 3, 'approved', 9001, now()),
  (9003, 'Sample', 'Sales', 'Sample.Sales@Example.test', 'not-a-real-hash', 1, 'pending', NULL, NULL),
  (9004, 'Sample', 'Admin', 'sample.admin@example.test', 'not-a-real-hash', 4, 'approved', 9001, now());

INSERT INTO providers (id, name, description, created_by) VALUES
  (9001, 'Sample Provider', 'Fixture provider', 9001);

INSERT INTO trainings (id, name, provider_id, description, duration, duration_unit, created_by) VALUES
  (9001, 'Sample Training', 9001, 'Fixture training', 3, 'days', 9001),
  (9002, 'Legacy Training Without Unit', 9001, NULL, 5, NULL, 9001),
  (9003, 'Legacy Training Without Duration', 9001, NULL, NULL, NULL, 9001);

INSERT INTO clients (id, company_name, email, phone, created_by, country) VALUES
  (9001, 'Sample Client', 'contact@sample-client.example.test', '+33123456789', 9001, 'FR'),
  (9002, 'Legacy Client', '', NULL, 9001, NULL);

INSERT INTO instructors (id, user_id, bio) VALUES
  (9001, 9002, 'Fixture instructor');

INSERT INTO instructor_skills (instructor_id, training_id, certificate_id, certificate_expires_at, expiry_reminder_sent_at) VALUES
  (9001, 9001, 'CERT-9001', now() + interval '1 year', NULL),
  (9001, 9002, NULL, NULL, NULL);

INSERT INTO training_sessions (id, training_id, client_id, instructor_id, start_date, end_date, session_status, assignment_status, created_by) VALUES
  (9001, 9001, 9001, 9001, now() + interval '10 days', now() + interval '12 days', 'scheduled', 'accepted', 9001),
  (9002, 9002, 9001, 9001, now() + interval '11 days', now() + interval '13 days', 'scheduled', 'pending', 9001),
  (9003, 9001, 9002, NULL, now() + interval '30 days', now() + interval '31 days', 'scheduled', 'unassigned', 9001),
  (9004, 9003, 9002, 9001, now() - interval '30 days', now() - interval '29 days', 'completed', 'accepted', 9001);

INSERT INTO session_attendees (id, session_id, name, email, survey_submitted, attendance_status) VALUES
  (9001, 9004, 'Alice Fixture', 'alice@example.test', true, 'present'),
  (9002, 9004, 'Bob Legacy', '', false, 'absent'),
  (9003, 9001, 'Alice Fixture', 'alice@example.test', false, 'pending');

INSERT INTO calendar (id, session_id, event_date, end_date, title) VALUES
  (9001, 9001, now() + interval '10 days', now() + interval '12 days', 'Sample Training'),
  (9002, 9004, now() - interval '30 days', now() - interval '29 days', 'Legacy Training Without Duration');

INSERT INTO surveys (id, session_id, instructor_id, attendee_id, instructor_score, nps_score, comments) VALUES
  (9001, 9004, 9001, 9001, 5, 9, 'Great session'),
  (9002, 9004, 9001, NULL, 4, 8, NULL);

INSERT INTO reports (id, session_id, pdf_url, average_score, nps_average) VALUES
  (9001, 9004, '/reports/fixture.pdf', 4.50, 8.50);

INSERT INTO audit_log (id, actor_id, action, entity_type, entity_id, before, after) VALUES
  (9001, 9001, 'create', 'User', 9002, NULL, '{"id": 9002, "email": "sample.instructor@example.test"}'),
  (9002, 9001, 'update', 'Session', 9001, '{"assignment_status": "pending"}', '{"assignment_status": "accepted"}');

INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth) VALUES
  (9001, 9002, 'https://push.example.test/subscription/9001', 'fixture-p256dh', 'fixture-auth');

INSERT INTO feedback_reports (id, submitted_by, category, message) VALUES
  (9001, 9002, 'bug', 'Fixture feedback');

INSERT INTO feature_announcements (id, created_by, title, description, target_roles) VALUES
  (9001, 9001, 'Fixture announcement', 'Fixture description', '["Manager", "Sales"]');

INSERT INTO feature_announcement_ratings (id, announcement_id, user_id, stars) VALUES
  (9001, 9001, 9002, 5);

INSERT INTO session_notes (id, session_id, instructor_id, body) VALUES
  (9001, 9004, 9001, 'Fixture note');

INSERT INTO conversations (id, type, name, created_by) VALUES
  (9001, 'direct', NULL, 9001),
  (9002, 'group', 'Fixture group', 9001);

INSERT INTO messages (id, conversation_id, sender_id, type, body, attachment_key, attachment_original_name, attachment_mime, attachment_size_bytes, reply_to_message_id) VALUES
  (9001, 9001, 9001, 'text', 'Hello', NULL, NULL, NULL, NULL, NULL),
  (9002, 9001, 9002, 'text', 'Hi back', NULL, NULL, NULL, NULL, 9001),
  (9003, 9001, 9002, 'file', NULL, 'fixture-key', 'notes.pdf', 'application/pdf', 1234, NULL),
  (9004, 9002, 9001, 'text', 'Group hello', NULL, NULL, NULL, NULL, NULL);

INSERT INTO conversation_participants (conversation_id, user_id, role, last_read_message_id, last_read_at, last_delivered_message_id, last_delivered_at) VALUES
  (9001, 9001, 'owner', 9002, now(), 9002, now()),
  (9001, 9002, 'member', 9001, now(), 9003, now()),
  (9002, 9001, 'owner', NULL, NULL, NULL, NULL);

INSERT INTO message_deletions (message_id, user_id) VALUES
  (9001, 9002);
