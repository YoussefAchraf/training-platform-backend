ALTER TABLE session_attendees
  ADD CONSTRAINT uq_session_attendees_id_session UNIQUE USING INDEX uq_session_attendees_id_session;
ALTER TABLE messages
  ADD CONSTRAINT uq_messages_id_conversation UNIQUE USING INDEX uq_messages_id_conversation;

ALTER TABLE users
  ADD CONSTRAINT ck_users_names_not_blank CHECK (char_length(btrim(firstname)) > 0 AND char_length(btrim(lastname)) > 0) NOT VALID,
  ADD CONSTRAINT ck_users_email_format CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+$') NOT VALID;

ALTER TABLE providers
  ADD CONSTRAINT ck_providers_name_not_blank CHECK (char_length(btrim(name)) > 0) NOT VALID;

ALTER TABLE trainings
  ADD CONSTRAINT ck_trainings_name_not_blank CHECK (char_length(btrim(name)) > 0) NOT VALID,
  ADD CONSTRAINT ck_trainings_duration_non_negative CHECK (duration IS NULL OR duration >= 0) NOT VALID,
  ADD CONSTRAINT ck_trainings_unit_requires_duration CHECK (duration_unit IS NULL OR duration IS NOT NULL) NOT VALID;

ALTER TABLE clients
  ADD CONSTRAINT ck_clients_company_name_not_blank CHECK (char_length(btrim(company_name)) > 0) NOT VALID,
  ADD CONSTRAINT ck_clients_email_format CHECK (email IS NULL OR email = '' OR email ~ '^[^@[:space:]]+@[^@[:space:]]+$') NOT VALID,
  ADD CONSTRAINT ck_clients_country_iso2 CHECK (country IS NULL OR country ~ '^[A-Z]{2}$') NOT VALID;

ALTER TABLE session_attendees
  ADD CONSTRAINT ck_session_attendees_name_not_blank CHECK (char_length(btrim(name)) > 0) NOT VALID,
  ADD CONSTRAINT ck_session_attendees_email_format CHECK (email IS NULL OR email = '' OR email ~ '^[^@[:space:]]+@[^@[:space:]]+$') NOT VALID;

ALTER TABLE feature_announcements
  ADD CONSTRAINT ck_feature_announcements_title_not_blank CHECK (char_length(btrim(title)) > 0) NOT VALID;

ALTER TABLE calendar
  ADD CONSTRAINT ck_calendar_title_not_blank CHECK (char_length(btrim(title)) > 0) NOT VALID;

ALTER TABLE session_notes
  ADD CONSTRAINT ck_session_notes_body_not_blank CHECK (char_length(btrim(body)) > 0) NOT VALID;

ALTER TABLE push_subscriptions
  ADD CONSTRAINT ck_push_subscriptions_endpoint_https CHECK (endpoint ~ '^https://') NOT VALID;

ALTER TABLE messages
  ADD CONSTRAINT ck_messages_attachment_non_negative CHECK (
    (attachment_size_bytes IS NULL OR attachment_size_bytes >= 0)
    AND (attachment_duration_seconds IS NULL OR attachment_duration_seconds >= 0)
  ) NOT VALID,
  ADD CONSTRAINT ck_messages_content_shape CHECK (
    deleted_at IS NOT NULL
    OR (type = 'text' AND body IS NOT NULL AND attachment_key IS NULL)
    OR (type <> 'text' AND attachment_key IS NOT NULL)
  ) NOT VALID;

ALTER TABLE surveys
  ADD CONSTRAINT fk_surveys_attendee_session
  FOREIGN KEY (attendee_id, session_id) REFERENCES session_attendees (id, session_id) NOT VALID;

ALTER TABLE messages
  ADD CONSTRAINT fk_messages_reply_same_conversation
  FOREIGN KEY (reply_to_message_id, conversation_id) REFERENCES messages (id, conversation_id)
  ON DELETE SET NULL (reply_to_message_id) NOT VALID;

ALTER TABLE conversation_participants
  ADD CONSTRAINT fk_participants_last_read_same_conversation
  FOREIGN KEY (last_read_message_id, conversation_id) REFERENCES messages (id, conversation_id)
  ON DELETE SET NULL (last_read_message_id) NOT VALID,
  ADD CONSTRAINT fk_participants_last_delivered_same_conversation
  FOREIGN KEY (last_delivered_message_id, conversation_id) REFERENCES messages (id, conversation_id)
  ON DELETE SET NULL (last_delivered_message_id) NOT VALID;
