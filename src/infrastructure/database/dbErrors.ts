export class DatabaseError extends Error {
  code?: string;
  pgCode?: string;
  constraint?: string;

  constructor(message: string, details: { code?: string; pgCode?: string; constraint?: string } = {}) {
    super(message);
    this.name = 'DatabaseError';
    this.code = details.code;
    this.pgCode = details.pgCode;
    this.constraint = details.constraint;
  }
}

const UNIQUE_MESSAGES: Record<string, string> = {
  users_email_lower_key: 'An account with this email already exists',
  users_email_key: 'An account with this email already exists',
  session_attendees_session_email_key: 'This email is already registered in this session',
  surveys_attendee_id_key: 'This attendee has already submitted a survey for this session',
  training_sessions_instructor_start_key: 'This instructor is already engaged in another session at that exact start time',
  training_sessions_training_start_key: 'Another session for this training already starts at the exact same time',
  idx_providers_name_active: 'A provider with this name already exists',
  instructors_user_id_key: 'This user is already an instructor',
  reports_session_id_key: 'A report already exists for this session',
  feature_announcement_ratings_announcement_id_user_id_key: 'You have already rated this announcement',
  push_subscriptions_user_id_endpoint_key: 'This device is already subscribed',
  roles_name_key: 'A role with this name already exists',
};

const CHECK_MESSAGES: Record<string, string> = {
  ck_users_names_not_blank: 'First name and last name must not be blank',
  ck_users_email_format: 'email must be a valid email address',
  ck_providers_name_not_blank: 'name must not be blank',
  ck_trainings_name_not_blank: 'name must not be blank',
  ck_trainings_duration_non_negative: 'duration must not be negative',
  ck_trainings_unit_requires_duration: 'durationUnit requires a duration',
  ck_clients_company_name_not_blank: 'companyName must not be blank',
  ck_clients_email_format: 'email must be a valid email address',
  ck_clients_country_iso2: 'country must be a 2-letter uppercase ISO country code',
  ck_session_attendees_name_not_blank: 'Attendee name is required',
  ck_session_attendees_email_format: 'email must be a valid email address',
  ck_feature_announcements_title_not_blank: 'title must not be blank',
  ck_calendar_title_not_blank: 'title must not be blank',
  ck_session_notes_body_not_blank: 'Note body must not be blank',
  ck_push_subscriptions_endpoint_https: 'endpoint must be an https URL',
  ck_messages_attachment_non_negative: 'Attachment size and duration must not be negative',
  ck_messages_content_shape: 'Message content does not match its type',
  surveys_instructor_score_check: 'instructorScore must be between 0 and 5',
  surveys_nps_score_check: 'npsScore must be between 0 and 10',
  training_sessions_check: 'endDate must be after startDate',
  feature_announcement_ratings_stars_check: 'stars must be between 1 and 5',
};

const FOREIGN_KEY_MESSAGES: Record<string, string> = {
  fk_surveys_attendee_session: 'The attendee does not belong to this session',
  fk_messages_reply_same_conversation: 'The message being replied to belongs to another conversation',
  fk_participants_last_read_same_conversation: 'A read marker must reference a message in the same conversation',
  fk_participants_last_delivered_same_conversation: 'A delivery marker must reference a message in the same conversation',
};

const PG_CODE_MESSAGES: Record<string, (constraint?: string) => string> = {
  '23505': (c) => (c && UNIQUE_MESSAGES[c]) || 'A record with the same unique value already exists',
  '23514': (c) => (c && CHECK_MESSAGES[c]) || 'One of the submitted values is not allowed',
  '23503': (c) => (c && FOREIGN_KEY_MESSAGES[c]) || 'The referenced record does not exist, or this record is still in use',
  '23502': () => 'A required value is missing',
  '22001': () => 'A value is longer than allowed',
  '22P02': () => 'A value has an invalid format',
  '22003': () => 'A number is out of range',
  '22007': () => 'A date or time value has an invalid format',
  '22008': () => 'A date or time value is out of range',
};

const PRISMA_CODE_MESSAGES: Record<string, string> = {
  P2000: 'A value is longer than allowed',
  P2002: 'A record with the same unique value already exists',
  P2003: 'The referenced record does not exist, or this record is still in use',
  P2011: 'A required value is missing',
  P2012: 'A required value is missing',
  P2025: 'The record was not found',
};

const GENERIC_MESSAGE = 'The request could not be processed';

function isPrismaError(err: any): boolean {
  return typeof err?.name === 'string' && err.name.startsWith('PrismaClient');
}

function extractConstraint(cause: any): string | undefined {
  const fromMessage = /constraint "([^"]+)"/.exec(String(cause?.originalMessage ?? cause?.message ?? ''));
  return fromMessage?.[1] ?? cause?.constraint?.index ?? undefined;
}

export function translateDbError(err: any): DatabaseError | null {
  if (!isPrismaError(err)) return null;

  const cause = err.meta?.driverAdapterError?.cause;
  const pgCode: string | undefined = cause?.originalCode ?? cause?.code;
  const constraint = extractConstraint(cause);
  const prismaCode: string | undefined = typeof err.code === 'string' ? err.code : undefined;

  const message =
    (pgCode && PG_CODE_MESSAGES[pgCode]?.(constraint)) ||
    (prismaCode && PRISMA_CODE_MESSAGES[prismaCode]) ||
    GENERIC_MESSAGE;

  return new DatabaseError(message, { code: prismaCode, pgCode, constraint });
}

export function isRoutineDbError(error: DatabaseError): boolean {
  return error.message !== GENERIC_MESSAGE;
}
