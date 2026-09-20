CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS users_email_lower_key
  ON users (lower(email));

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS surveys_attendee_id_key
  ON surveys (attendee_id)
  WHERE attendee_id IS NOT NULL;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS session_attendees_session_email_key
  ON session_attendees (session_id, lower(email))
  WHERE email IS NOT NULL AND email <> '';

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS training_sessions_instructor_start_key
  ON training_sessions (instructor_id, start_date)
  WHERE instructor_id IS NOT NULL AND session_status <> 'cancelled';

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS training_sessions_training_start_key
  ON training_sessions (training_id, start_date)
  WHERE session_status <> 'cancelled';

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_session_attendees_id_session
  ON session_attendees (id, session_id);

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_messages_id_conversation
  ON messages (id, conversation_id);
