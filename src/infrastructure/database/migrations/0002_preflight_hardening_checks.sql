DO $$
DECLARE
  problems text := '';
  n bigint;
  sample int[];
BEGIN
  SELECT count(*), (array_agg(k ORDER BY k))[1:10] INTO n, sample FROM (
    SELECT min(id) AS k FROM users GROUP BY lower(email) HAVING count(*) > 1) d;
  IF n > 0 THEN problems := problems || format('%s- users: %s email group(s) differ only by letter case (example user ids %s)', chr(10), n, sample); END IF;

  SELECT count(*), (array_agg(k ORDER BY k))[1:10] INTO n, sample FROM (
    SELECT min(id) AS k FROM surveys WHERE attendee_id IS NOT NULL GROUP BY attendee_id HAVING count(*) > 1) d;
  IF n > 0 THEN problems := problems || format('%s- surveys: %s attendee(s) have more than one survey (example survey ids %s)', chr(10), n, sample); END IF;

  SELECT count(*), (array_agg(k ORDER BY k))[1:10] INTO n, sample FROM (
    SELECT min(id) AS k FROM session_attendees WHERE email IS NOT NULL AND email <> ''
    GROUP BY session_id, lower(email) HAVING count(*) > 1) d;
  IF n > 0 THEN problems := problems || format('%s- session_attendees: %s email(s) registered more than once in the same session (example attendee ids %s)', chr(10), n, sample); END IF;

  SELECT count(*), (array_agg(k ORDER BY k))[1:10] INTO n, sample FROM (
    SELECT min(id) AS k FROM training_sessions WHERE instructor_id IS NOT NULL AND session_status <> 'cancelled'
    GROUP BY instructor_id, start_date HAVING count(*) > 1) d;
  IF n > 0 THEN problems := problems || format('%s- training_sessions: %s instructor(s) booked twice at the same start time (example session ids %s)', chr(10), n, sample); END IF;

  SELECT count(*), (array_agg(k ORDER BY k))[1:10] INTO n, sample FROM (
    SELECT min(id) AS k FROM training_sessions WHERE session_status <> 'cancelled'
    GROUP BY training_id, start_date HAVING count(*) > 1) d;
  IF n > 0 THEN problems := problems || format('%s- training_sessions: %s training(s) scheduled twice at the same start time (example session ids %s)', chr(10), n, sample); END IF;

  SELECT count(*), (array_agg(s.id ORDER BY s.id))[1:10] INTO n, sample
  FROM surveys s JOIN session_attendees a ON a.id = s.attendee_id WHERE s.session_id <> a.session_id;
  IF n > 0 THEN problems := problems || format('%s- surveys: %s survey(s) point at an attendee of a different session (example survey ids %s)', chr(10), n, sample); END IF;

  SELECT count(*), (array_agg(m.id ORDER BY m.id))[1:10] INTO n, sample
  FROM messages m JOIN messages r ON r.id = m.reply_to_message_id WHERE r.conversation_id <> m.conversation_id;
  IF n > 0 THEN problems := problems || format('%s- messages: %s repl(ies) target a message in another conversation (example message ids %s)', chr(10), n, sample); END IF;

  SELECT count(*), (array_agg(p.user_id ORDER BY p.user_id))[1:10] INTO n, sample
  FROM conversation_participants p JOIN messages m ON m.id = p.last_read_message_id WHERE m.conversation_id <> p.conversation_id;
  IF n > 0 THEN problems := problems || format('%s- conversation_participants: %s last_read marker(s) point into another conversation (example user ids %s)', chr(10), n, sample); END IF;

  SELECT count(*), (array_agg(p.user_id ORDER BY p.user_id))[1:10] INTO n, sample
  FROM conversation_participants p JOIN messages m ON m.id = p.last_delivered_message_id WHERE m.conversation_id <> p.conversation_id;
  IF n > 0 THEN problems := problems || format('%s- conversation_participants: %s last_delivered marker(s) point into another conversation (example user ids %s)', chr(10), n, sample); END IF;

  SELECT count(*), (array_agg(id ORDER BY id))[1:10] INTO n, sample FROM users
  WHERE char_length(btrim(firstname)) = 0 OR char_length(btrim(lastname)) = 0
     OR NOT (email ~ '^[^@[:space:]]+@[^@[:space:]]+$');
  IF n > 0 THEN problems := problems || format('%s- users: %s row(s) with a blank name or malformed email (example ids %s)', chr(10), n, sample); END IF;

  SELECT count(*), (array_agg(id ORDER BY id))[1:10] INTO n, sample FROM providers WHERE char_length(btrim(name)) = 0;
  IF n > 0 THEN problems := problems || format('%s- providers: %s blank name(s) (example ids %s)', chr(10), n, sample); END IF;

  SELECT count(*), (array_agg(id ORDER BY id))[1:10] INTO n, sample FROM trainings
  WHERE char_length(btrim(name)) = 0 OR (duration IS NOT NULL AND duration < 0) OR (duration_unit IS NOT NULL AND duration IS NULL);
  IF n > 0 THEN problems := problems || format('%s- trainings: %s row(s) with a blank name, negative duration, or a unit without a duration (example ids %s)', chr(10), n, sample); END IF;

  SELECT count(*), (array_agg(id ORDER BY id))[1:10] INTO n, sample FROM clients
  WHERE char_length(btrim(company_name)) = 0
     OR (email IS NOT NULL AND email <> '' AND NOT (email ~ '^[^@[:space:]]+@[^@[:space:]]+$'))
     OR (country IS NOT NULL AND NOT (country ~ '^[A-Z]{2}$'));
  IF n > 0 THEN problems := problems || format('%s- clients: %s row(s) with a blank name, malformed email, or invalid country code (example ids %s)', chr(10), n, sample); END IF;

  SELECT count(*), (array_agg(id ORDER BY id))[1:10] INTO n, sample FROM session_attendees
  WHERE char_length(btrim(name)) = 0
     OR (email IS NOT NULL AND email <> '' AND NOT (email ~ '^[^@[:space:]]+@[^@[:space:]]+$'));
  IF n > 0 THEN problems := problems || format('%s- session_attendees: %s row(s) with a blank name or malformed email (example ids %s)', chr(10), n, sample); END IF;

  SELECT count(*), (array_agg(id ORDER BY id))[1:10] INTO n, sample FROM feature_announcements WHERE char_length(btrim(title)) = 0;
  IF n > 0 THEN problems := problems || format('%s- feature_announcements: %s blank title(s) (example ids %s)', chr(10), n, sample); END IF;

  SELECT count(*), (array_agg(id ORDER BY id))[1:10] INTO n, sample FROM calendar WHERE char_length(btrim(title)) = 0;
  IF n > 0 THEN problems := problems || format('%s- calendar: %s blank title(s) (example ids %s)', chr(10), n, sample); END IF;

  SELECT count(*), (array_agg(id ORDER BY id))[1:10] INTO n, sample FROM session_notes WHERE char_length(btrim(body)) = 0;
  IF n > 0 THEN problems := problems || format('%s- session_notes: %s blank note(s) (example ids %s)', chr(10), n, sample); END IF;

  SELECT count(*), (array_agg(id ORDER BY id))[1:10] INTO n, sample FROM push_subscriptions WHERE NOT (endpoint ~ '^https://');
  IF n > 0 THEN problems := problems || format('%s- push_subscriptions: %s non-https endpoint(s) (example ids %s)', chr(10), n, sample); END IF;

  SELECT count(*), (array_agg(id ORDER BY id))[1:10] INTO n, sample FROM messages
  WHERE attachment_size_bytes < 0 OR attachment_duration_seconds < 0
     OR NOT (deleted_at IS NOT NULL
             OR (type = 'text' AND body IS NOT NULL AND attachment_key IS NULL)
             OR (type <> 'text' AND attachment_key IS NOT NULL));
  IF n > 0 THEN problems := problems || format('%s- messages: %s row(s) with a negative size/duration or an inconsistent type/body/attachment (example ids %s)', chr(10), n, sample); END IF;

  IF problems <> '' THEN
    RAISE EXCEPTION 'Existing data conflicts with the new database constraints. Nothing was changed. Review these rows (no rows are modified by migrations), then re-run:%', problems;
  END IF;
END
$$;
