import { DatabaseError, isRoutineDbError, translateDbError } from '../../../src/infrastructure/database/dbErrors';

function prismaError(prismaCode: string, pgCode?: string, originalMessage?: string, name = 'PrismaClientKnownRequestError') {
  return {
    name,
    code: prismaCode,
    message: 'Invalid `prisma.users.create()` invocation in /app/dist/secret/path.js:12:3\n\n  await prisma.users.create({ data: { password_hash: "hunter2" } })',
    meta: pgCode ? { driverAdapterError: { cause: { originalCode: pgCode, originalMessage, detail: 'Failing row contains (1, hunter2)' } } } : undefined,
  };
}

describe('translateDbError', () => {
  it('ignores errors that are not Prisma errors (domain errors keep their own message)', () => {
    expect(translateDbError(new Error('Provider not found'))).toBeNull();
    expect(translateDbError(null)).toBeNull();
    expect(translateDbError({ name: 'TypeError', message: 'x' })).toBeNull();
  });

  it('maps unique violations to a friendly message by constraint name', () => {
    const err = translateDbError(prismaError('P2002', '23505', 'duplicate key value violates unique constraint "users_email_lower_key"'));
    expect(err).toBeInstanceOf(DatabaseError);
    expect(err?.message).toBe('An account with this email already exists');
    expect(err?.constraint).toBe('users_email_lower_key');
    expect(err?.code).toBe('P2002');
    expect(err?.pgCode).toBe('23505');
  });

  it('maps the new scheduling and attendee constraints to the same wording the use cases use', () => {
    const msg = (c: string) =>
      translateDbError(prismaError('P2002', '23505', `duplicate key value violates unique constraint "${c}"`))?.message;
    expect(msg('training_sessions_instructor_start_key')).toBe('This instructor is already engaged in another session at that exact start time');
    expect(msg('training_sessions_training_start_key')).toBe('Another session for this training already starts at the exact same time');
    expect(msg('session_attendees_session_email_key')).toBe('This email is already registered in this session');
    expect(msg('some_unknown_key')).toBe('A record with the same unique value already exists');
  });

  it('maps check and foreign-key violations', () => {
    expect(
      translateDbError(prismaError('P2039', '23514', 'new row for relation "clients" violates check constraint "ck_clients_country_iso2"'))?.message
    ).toBe('country must be a 2-letter uppercase ISO country code');
    expect(
      translateDbError(prismaError('P2003', '23503', 'insert or update on table "surveys" violates foreign key constraint "fk_surveys_attendee_session"'))?.message
    ).toBe('The attendee does not belong to this session');
    expect(translateDbError(prismaError('P2003', '23503', 'violates foreign key constraint "whatever_fkey"'))?.message).toBe(
      'The referenced record does not exist, or this record is still in use'
    );
  });

  it('falls back on Prisma codes when there is no driver detail', () => {
    expect(translateDbError(prismaError('P2025'))?.message).toBe('The record was not found');
    expect(translateDbError(prismaError('P2000'))?.message).toBe('A value is longer than allowed');
  });

  it('never leaks the invocation snippet, file paths, or row data, and hides unknown errors behind a generic message', () => {
    const cases = [
      prismaError('P2002', '23505', 'duplicate key value violates unique constraint "users_email_key"'),
      prismaError('P2039', '23514', 'violates check constraint "ck_users_names_not_blank"'),
      prismaError('P9999'),
      prismaError('', undefined, undefined, 'PrismaClientValidationError'),
      prismaError('P2010', '42P01', 'relation "secret_table" does not exist'),
    ];
    for (const raw of cases) {
      const translated = translateDbError(raw) as DatabaseError;
      expect(translated.message).not.toMatch(/invocation|prisma|\/app\/|hunter2|Failing row|secret_table|password/i);
      expect(JSON.stringify(translated)).not.toMatch(/hunter2|Failing row/);
    }
    const generic = translateDbError(prismaError('P9999')) as DatabaseError;
    expect(generic.message).toBe('The request could not be processed');
    expect(isRoutineDbError(generic)).toBe(false);
    expect(isRoutineDbError(translateDbError(prismaError('P2025')) as DatabaseError)).toBe(true);
  });
});
