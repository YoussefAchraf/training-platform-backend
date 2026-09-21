COMMENT ON TABLE roles IS 'Fixed set of application roles (Sales, Manager, Instructor, SuperAdmin, Developer). Reference data seeded by the baseline migration.';
COMMENT ON TABLE users IS 'Every account. Self-signup creates status pending; a Manager approves or rejects. Emails are unique ignoring letter case.';
COMMENT ON COLUMN users.status IS 'pending (awaiting approval), approved, rejected, or deactivated (soft-disabled by a SuperAdmin).';
COMMENT ON COLUMN users.approved_by IS 'The approving Manager. Set to NULL if that account is later purged.';
COMMENT ON COLUMN users.has_seen_tour IS 'Whether the guided-tour dashboard has already auto-launched for this user.';

COMMENT ON TABLE providers IS 'Training providers (e.g. Red Hat). Soft-deleted via deleted_at; names are unique among active providers.';
COMMENT ON TABLE trainings IS 'Catalog of trainings offered, each belonging to one provider. Soft-deleted via deleted_at.';
COMMENT ON COLUMN trainings.duration IS 'Length in duration_unit. May be 0. Some legacy rows have a duration without a unit.';
COMMENT ON TABLE clients IS 'Client companies that training sessions are delivered to. Soft-deleted via deleted_at.';
COMMENT ON COLUMN clients.country IS 'ISO 3166-1 alpha-2 code in upper case; used to validate the phone number.';

COMMENT ON TABLE instructors IS 'Instructor profile, one per instructor user (user_id is unique).';
COMMENT ON TABLE instructor_skills IS 'Which trainings an instructor can teach (many-to-many), with an optional certificate and its expiry.';
COMMENT ON COLUMN instructor_skills.expiry_reminder_sent_at IS 'Set once the one-time certificate-expiry reminder has been emailed.';

COMMENT ON TABLE training_sessions IS 'A scheduled delivery of one training for one client, optionally assigned to one instructor. The central table of the domain.';
COMMENT ON COLUMN training_sessions.assignment_status IS 'unassigned or accepted in current use. pending and refused are legacy states of a retired accept/refuse flow.';
COMMENT ON COLUMN training_sessions.include_weekends IS 'Whether the session runs on weekends between start_date and end_date.';
COMMENT ON COLUMN training_sessions.reminder_24h_sent_at IS 'Set when the 24-hour push reminder was sent, so it is sent once.';
COMMENT ON COLUMN training_sessions.reminder_1h_sent_at IS 'Set when the 1-hour push reminder was sent, so it is sent once.';
COMMENT ON TABLE session_attendees IS 'People registered on a session. Identity is the name plus an optional email; an email may appear once per session (case-insensitive).';
COMMENT ON COLUMN session_attendees.survey_submitted IS 'Denormalised flag kept in step with the existence of a survey row for this attendee.';
COMMENT ON COLUMN session_attendees.attendance_status IS 'pending, present or absent, marked by the instructor.';
COMMENT ON TABLE session_notes IS 'Free-text notes an assigned instructor leaves on a session. Only the author may edit or delete.';
COMMENT ON TABLE calendar IS 'Calendar entry generated with a session; a deliberate copy of the session dates so the calendar can be edited independently.';

COMMENT ON TABLE surveys IS 'One survey answer per attendee (attendee_id unique when present). Scores: instructor 0-5, NPS 0-10.';
COMMENT ON COLUMN surveys.instructor_id IS 'Snapshot of the instructor at submission time; deliberately not derived from the session, which may be reassigned later.';
COMMENT ON TABLE reports IS 'Generated report per session (session_id unique) with the averaged scores frozen at generation time.';

COMMENT ON TABLE audit_log IS 'Append-only history of create/update/delete/approve/reject/cancel actions. The application role cannot delete rows or rewrite history.';
COMMENT ON COLUMN audit_log.actor_id IS 'Who acted. Becomes NULL if the account is purged; actor_deleted then marks it.';
COMMENT ON COLUMN audit_log.before IS 'Snapshot before the change. The GDPR purge may redact personal fields here.';
COMMENT ON COLUMN audit_log.after IS 'Snapshot after the change. The GDPR purge may redact personal fields here.';
COMMENT ON COLUMN audit_log.actor_deleted IS 'True once the acting account has been purged and its entries redacted.';

COMMENT ON TABLE push_subscriptions IS 'Web-push endpoints per user and device (unique per user and endpoint). Endpoints must be https.';
COMMENT ON TABLE feedback_reports IS 'Bug reports and enhancement requests submitted by users; read by the Developer role.';
COMMENT ON TABLE feature_announcements IS 'Product announcements written by the Developer role and shown to targeted roles until rated.';
COMMENT ON COLUMN feature_announcements.target_roles IS 'DEPRECATED write-through copy of the targeted role names. The relational source is feature_announcement_target_roles, kept in sync by a trigger. To be dropped in a later, explicitly approved migration.';
COMMENT ON TABLE feature_announcement_target_roles IS 'Which roles an announcement targets (junction table; replaces the JSON list, giving first normal form and foreign-key integrity).';
COMMENT ON TABLE feature_announcement_ratings IS 'One 1-5 star rating per user per announcement.';

COMMENT ON TABLE conversations IS 'A direct (two-person) or group conversation in the messaging module.';
COMMENT ON TABLE conversation_participants IS 'Membership, per-user read/delivered markers and hide/mute state for a conversation.';
COMMENT ON COLUMN conversation_participants.hidden_at IS 'Set when the user hides the conversation from their list; a new message can bring it back.';
COMMENT ON COLUMN conversation_participants.muted_at IS 'Set when the user mutes notifications for the conversation.';
COMMENT ON COLUMN conversation_participants.last_read_message_id IS 'Read marker; must reference a message of the same conversation.';
COMMENT ON COLUMN conversation_participants.last_delivered_message_id IS 'Delivery marker; must reference a message of the same conversation.';
COMMENT ON TABLE messages IS 'Chat messages: text, image, voice or file. Attachments live on disk; only their key and metadata are stored here. Soft-deleted via deleted_at.';
COMMENT ON COLUMN messages.reply_to_message_id IS 'The message being replied to; must be in the same conversation.';
COMMENT ON COLUMN messages.deleted_at IS 'Set when deleted for everyone; content is then no longer shown.';
COMMENT ON TABLE message_deletions IS 'Per-user "delete for me" markers; the message stays visible to everyone else.';
