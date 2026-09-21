import { Pool } from 'pg';
import type { PoolClient } from 'pg';

const adminUrl = process.env.TEST_ADMIN_DATABASE_URL || process.env.MIGRATOR_DATABASE_URL || process.env.DATABASE_URL;
const runtimeUrl = process.env.DATABASE_URL;

const pool = new Pool({ connectionString: adminUrl, max: 2 });
const runtimePool = new Pool({ connectionString: runtimeUrl, max: 1 });

type Q = (sql: string, params?: unknown[]) => Promise<any>;

async function inTx<T>(fn: (q: Q) => Promise<T>): Promise<T> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');
    return await fn((sql, params) => client.query(sql, params));
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    client.release();
  }
}

async function violation(q: Q, sql: string, params: unknown[] = []) {
  await q('SAVEPOINT probe');
  try {
    await q(sql, params);
  } catch (err) {
    await q('ROLLBACK TO SAVEPOINT probe');
    return { code: err.code as string, constraint: err.constraint as string | undefined };
  }
  await q('RELEASE SAVEPOINT probe');
  return null;
}

const tag = () => `dbc${Date.now()}${Math.floor(Math.random() * 1e6)}`;

async function seed(q: Q) {
  const t = tag();
  const role = (await q('SELECT id FROM roles ORDER BY id LIMIT 1')).rows[0].id;
  const user = (await q(
    `INSERT INTO users (firstname, lastname, email, password_hash, role_id) VALUES ('Db','Tester',$1,'x',$2) RETURNING id`,
    [`${t}@example.test`, role]
  )).rows[0].id;
  const user2 = (await q(
    `INSERT INTO users (firstname, lastname, email, password_hash, role_id) VALUES ('Db','Tester2',$1,'x',$2) RETURNING id`,
    [`${t}-2@example.test`, role]
  )).rows[0].id;
  const provider = (await q(`INSERT INTO providers (name) VALUES ($1) RETURNING id`, [`${t}-p`])).rows[0].id;
  const training = (await q(`INSERT INTO trainings (name, provider_id) VALUES ($1,$2) RETURNING id`, [`${t}-t1`, provider])).rows[0].id;
  const training2 = (await q(`INSERT INTO trainings (name, provider_id) VALUES ($1,$2) RETURNING id`, [`${t}-t2`, provider])).rows[0].id;
  const client = (await q(`INSERT INTO clients (company_name) VALUES ($1) RETURNING id`, [`${t}-c`])).rows[0].id;
  const instructor = (await q(`INSERT INTO instructors (user_id) VALUES ($1) RETURNING id`, [user])).rows[0].id;
  const instructor2 = (await q(`INSERT INTO instructors (user_id) VALUES ($1) RETURNING id`, [user2])).rows[0].id;
  return { t, role, user, user2, provider, training, training2, client, instructor, instructor2 };
}

async function session(q: Q, s: { training: number; client: number }, start: string, extra: { instructor?: number; status?: string; training?: number } = {}) {
  const end = new Date(new Date(start).getTime() + 3600_000).toISOString();
  return (await q(
    `INSERT INTO training_sessions (training_id, client_id, instructor_id, start_date, end_date, session_status)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [extra.training ?? s.training, s.client, extra.instructor ?? null, start, end, extra.status ?? 'scheduled']
  )).rows[0].id;
}

afterAll(async () => {
  await pool.end();
  await runtimePool.end();
});

describe('database constraints (real database, every case rolled back)', () => {
  it('users: emails are unique ignoring letter case', async () => {
    await inTx(async (q) => {
      const s = await seed(q);
      const dup = await violation(q, `INSERT INTO users (firstname, lastname, email, password_hash, role_id) VALUES ('A','B',$1,'x',$2)`, [
        `${s.t.toUpperCase()}@EXAMPLE.TEST`,
        s.role,
      ]);
      expect(dup).toEqual({ code: '23505', constraint: 'users_email_lower_key' });
    });
  });

  it('users: blank names and malformed emails are rejected', async () => {
    await inTx(async (q) => {
      const s = await seed(q);
      const insert = `INSERT INTO users (firstname, lastname, email, password_hash, role_id) VALUES ($1,$2,$3,'x',$4)`;
      expect(await violation(q, insert, ['  ', 'B', `${s.t}-a@example.test`, s.role])).toMatchObject({ code: '23514', constraint: 'ck_users_names_not_blank' });
      expect(await violation(q, insert, ['A', 'B', 'no-at-sign', s.role])).toMatchObject({ code: '23514', constraint: 'ck_users_email_format' });
      expect(await violation(q, insert, ['A', 'B', 'has space@example.test', s.role])).toMatchObject({ code: '23514' });
      expect(await violation(q, insert, ['A', 'B', `${s.t}-ok@localhost`, s.role])).toBeNull();
    });
  });

  it('trainings: duration may be 0 or unit-less (legacy) but never negative, and a unit needs a duration', async () => {
    await inTx(async (q) => {
      const s = await seed(q);
      const insert = `INSERT INTO trainings (name, provider_id, duration, duration_unit) VALUES ($1,$2,$3,$4)`;
      expect(await violation(q, insert, [`${s.t}-a`, s.provider, 0, 'days'])).toBeNull();
      expect(await violation(q, insert, [`${s.t}-b`, s.provider, 5, null])).toBeNull();
      expect(await violation(q, insert, [`${s.t}-c`, s.provider, null, null])).toBeNull();
      expect(await violation(q, insert, [`${s.t}-d`, s.provider, -1, 'days'])).toMatchObject({ constraint: 'ck_trainings_duration_non_negative' });
      expect(await violation(q, insert, [`${s.t}-e`, s.provider, null, 'hours'])).toMatchObject({ constraint: 'ck_trainings_unit_requires_duration' });
      expect(await violation(q, insert, ['   ', s.provider, 1, 'days'])).toMatchObject({ constraint: 'ck_trainings_name_not_blank' });
    });
  });

  it('clients: ISO-2 uppercase country, tolerant email (blank/NULL allowed), non-blank company name', async () => {
    await inTx(async (q) => {
      const insert = `INSERT INTO clients (company_name, email, country) VALUES ($1,$2,$3)`;
      expect(await violation(q, insert, ['A', '', 'FR'])).toBeNull();
      expect(await violation(q, insert, ['B', null, null])).toBeNull();
      expect(await violation(q, insert, ['C', 'x@y.test', 'fr'])).toMatchObject({ constraint: 'ck_clients_country_iso2' });
      expect(await violation(q, insert, ['D', 'not-an-email', 'FR'])).toMatchObject({ constraint: 'ck_clients_email_format' });
      expect(await violation(q, insert, ['  ', null, null])).toMatchObject({ constraint: 'ck_clients_company_name_not_blank' });
    });
  });

  it('sessions: a training cannot start twice at one instant, but cancelled sessions free the slot', async () => {
    await inTx(async (q) => {
      const s = await seed(q);
      const start = '2033-05-01T09:00:00Z';
      await session(q, s, start);
      const dup = await violation(q, `INSERT INTO training_sessions (training_id, client_id, start_date, end_date) VALUES ($1,$2,$3,$4)`, [
        s.training, s.client, start, '2033-05-01T10:00:00Z',
      ]);
      expect(dup).toEqual({ code: '23505', constraint: 'training_sessions_training_start_key' });
      expect(await violation(q, `INSERT INTO training_sessions (training_id, client_id, start_date, end_date, session_status) VALUES ($1,$2,$3,$4,'cancelled')`, [
        s.training, s.client, start, '2033-05-01T10:00:00Z',
      ])).toBeNull();
      expect(await session(q, s, start, { training: s.training2 })).toBeGreaterThan(0);
    });
  });

  it('sessions: an instructor cannot start two sessions at one instant, overlaps and other instructors are fine', async () => {
    await inTx(async (q) => {
      const s = await seed(q);
      const start = '2033-06-01T09:00:00Z';
      await session(q, s, start, { instructor: s.instructor });
      const dup = await violation(
        q,
        `INSERT INTO training_sessions (training_id, client_id, instructor_id, start_date, end_date) VALUES ($1,$2,$3,$4,$5)`,
        [s.training2, s.client, s.instructor, start, '2033-06-01T10:00:00Z']
      );
      expect(dup).toEqual({ code: '23505', constraint: 'training_sessions_instructor_start_key' });
      expect(await session(q, s, '2033-06-01T09:30:00Z', { instructor: s.instructor, training: s.training2 })).toBeGreaterThan(0);
      expect(await session(q, s, start, { instructor: s.instructor2, training: s.training2 })).toBeGreaterThan(0);
    });
  });

  it('attendees: an email is unique per session ignoring case; blank/NULL emails and other sessions are fine', async () => {
    await inTx(async (q) => {
      const s = await seed(q);
      const a = await session(q, s, '2033-07-01T09:00:00Z');
      const b = await session(q, s, '2033-07-02T09:00:00Z');
      const insert = `INSERT INTO session_attendees (session_id, name, email) VALUES ($1,$2,$3)`;
      expect(await violation(q, insert, [a, 'One', 'Same@Example.test'])).toBeNull();
      expect(await violation(q, insert, [a, 'Two', 'same@example.TEST'])).toEqual({ code: '23505', constraint: 'session_attendees_session_email_key' });
      expect(await violation(q, insert, [b, 'Three', 'same@example.test'])).toBeNull();
      expect(await violation(q, insert, [a, 'Blank1', ''])).toBeNull();
      expect(await violation(q, insert, [a, 'Blank2', ''])).toBeNull();
      expect(await violation(q, insert, [a, 'Null1', null])).toBeNull();
      expect(await violation(q, insert, [a, 'Null2', null])).toBeNull();
      expect(await violation(q, insert, [a, ' ', null])).toMatchObject({ constraint: 'ck_session_attendees_name_not_blank' });
      expect(await violation(q, insert, [a, 'Bad', 'nope'])).toMatchObject({ constraint: 'ck_session_attendees_email_format' });
    });
  });

  it('surveys: one survey per attendee, and the attendee must belong to the survey session', async () => {
    await inTx(async (q) => {
      const s = await seed(q);
      const a = await session(q, s, '2033-08-01T09:00:00Z');
      const b = await session(q, s, '2033-08-02T09:00:00Z');
      const attendee = (await q(`INSERT INTO session_attendees (session_id, name) VALUES ($1,'Att') RETURNING id`, [a])).rows[0].id;
      const insert = `INSERT INTO surveys (session_id, attendee_id, instructor_score, nps_score) VALUES ($1,$2,5,9)`;
      expect(await violation(q, insert, [a, attendee])).toBeNull();
      expect(await violation(q, insert, [a, attendee])).toEqual({ code: '23505', constraint: 'surveys_attendee_id_key' });
      const other = (await q(`INSERT INTO session_attendees (session_id, name) VALUES ($1,'Att2') RETURNING id`, [a])).rows[0].id;
      expect(await violation(q, insert, [b, other])).toEqual({ code: '23503', constraint: 'fk_surveys_attendee_session' });
      expect(await violation(q, `INSERT INTO surveys (session_id, instructor_score, nps_score) VALUES ($1,4,8)`, [a])).toBeNull();
      expect(await violation(q, `INSERT INTO surveys (session_id, instructor_score, nps_score) VALUES ($1,4,8)`, [a])).toBeNull();
    });
  });

  it('messages: shape rules, and replies/read markers must stay inside their conversation', async () => {
    await inTx(async (q) => {
      const s = await seed(q);
      const convo = (await q(`INSERT INTO conversations (type, created_by) VALUES ('group',$1) RETURNING id`, [s.user])).rows[0].id;
      const other = (await q(`INSERT INTO conversations (type, created_by) VALUES ('group',$1) RETURNING id`, [s.user])).rows[0].id;
      const insert = `INSERT INTO messages (conversation_id, sender_id, type, body, attachment_key, attachment_size_bytes, reply_to_message_id, deleted_at)
                      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`;

      expect(await violation(q, insert, [convo, s.user, 'text', null, null, null, null, null])).toMatchObject({ constraint: 'ck_messages_content_shape' });
      expect(await violation(q, insert, [convo, s.user, 'text', 'hi', 'k', null, null, null])).toMatchObject({ constraint: 'ck_messages_content_shape' });
      expect(await violation(q, insert, [convo, s.user, 'file', null, null, null, null, null])).toMatchObject({ constraint: 'ck_messages_content_shape' });
      expect(await violation(q, insert, [convo, s.user, 'file', null, 'k', -1, null, null])).toMatchObject({ constraint: 'ck_messages_attachment_non_negative' });
      expect(await violation(q, insert, [convo, s.user, 'text', null, null, null, null, new Date().toISOString()])).toBeNull();
      expect(await violation(q, insert, [convo, s.user, 'image', 'caption', 'k', 10, null, null])).toBeNull();

      const parent = (await q(insert, [convo, s.user, 'text', 'parent', null, null, null, null])).rows[0].id;
      const foreign = (await q(insert, [other, s.user, 'text', 'foreign', null, null, null, null])).rows[0].id;
      expect(await violation(q, insert, [convo, s.user, 'text', 'reply', null, null, foreign, null])).toEqual({ code: '23503', constraint: 'fk_messages_reply_same_conversation' });

      const reply = (await q(insert, [convo, s.user, 'text', 'reply', null, null, parent, null])).rows[0].id;
      await q(`INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1,$2)`, [convo, s.user]);
      expect(await violation(q, `UPDATE conversation_participants SET last_read_message_id = $1 WHERE conversation_id = $2 AND user_id = $3`, [foreign, convo, s.user]))
        .toEqual({ code: '23503', constraint: 'fk_participants_last_read_same_conversation' });
      expect(await violation(q, `UPDATE conversation_participants SET last_delivered_message_id = $1 WHERE conversation_id = $2 AND user_id = $3`, [foreign, convo, s.user]))
        .toEqual({ code: '23503', constraint: 'fk_participants_last_delivered_same_conversation' });
      await q(`UPDATE conversation_participants SET last_read_message_id = $1, last_delivered_message_id = $1 WHERE conversation_id = $2 AND user_id = $3`, [parent, convo, s.user]);

      await q('DELETE FROM messages WHERE id = $1', [parent]);
      const afterReply = (await q('SELECT reply_to_message_id, conversation_id FROM messages WHERE id = $1', [reply])).rows[0];
      expect(afterReply).toEqual({ reply_to_message_id: null, conversation_id: convo });
      const afterMarkers = (await q('SELECT last_read_message_id, last_delivered_message_id, conversation_id FROM conversation_participants WHERE user_id = $1 AND conversation_id = $2', [s.user, convo])).rows[0];
      expect(afterMarkers).toEqual({ last_read_message_id: null, last_delivered_message_id: null, conversation_id: convo });
    });
  });

  it('push subscriptions require https endpoints', async () => {
    await inTx(async (q) => {
      const s = await seed(q);
      const insert = `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1,$2,'k','a')`;
      expect(await violation(q, insert, [s.user, 'http://push.example.test/1'])).toMatchObject({ constraint: 'ck_push_subscriptions_endpoint_https' });
      expect(await violation(q, insert, [s.user, 'https://push.example.test/1'])).toBeNull();
    });
  });

  it('legacy shapes that exist in real data stay writable: blank attendee email, unit-less duration, overlapping sessions', async () => {
    await inTx(async (q) => {
      const s = await seed(q);
      const a = await session(q, s, '2033-09-01T09:00:00Z', { instructor: s.instructor });
      await session(q, s, '2033-09-01T09:30:00Z', { instructor: s.instructor, training: s.training2 });
      const attendee = (await q(`INSERT INTO session_attendees (session_id, name, email) VALUES ($1,'Legacy','') RETURNING id`, [a])).rows[0].id;
      await q(`UPDATE session_attendees SET attendance_status = 'present' WHERE id = $1`, [attendee]);
      const legacyTraining = (await q(`INSERT INTO trainings (name, provider_id, duration) VALUES ($1,$2,5) RETURNING id`, [`${s.t}-legacy`, s.provider])).rows[0].id;
      await q(`UPDATE trainings SET description = 'still editable' WHERE id = $1`, [legacyTraining]);
    });
  });
});

describe('audit_log is append-only for the application role (skipped when connected as a superuser)', () => {
  it('allows insert and the redaction columns, forbids rewriting history', async () => {
    const isSuper = (await runtimePool.query('SELECT rolsuper FROM pg_roles WHERE rolname = current_user')).rows[0].rolsuper;
    const owns = (await runtimePool.query(`SELECT pg_get_userbyid(relowner) = current_user AS o FROM pg_class WHERE relname = 'audit_log'`)).rows[0].o;
    if (isSuper || owns) return;

    const client = await runtimePool.connect();
    try {
      await client.query('BEGIN');
      const id = (await client.query(`INSERT INTO audit_log (action, entity_type, entity_id) VALUES ('probe','Probe',1) RETURNING id`)).rows[0].id;
      await client.query(`UPDATE audit_log SET actor_deleted = true, before = '{}'::jsonb, after = '{}'::jsonb WHERE id = $1`, [id]);
      await client.query('SAVEPOINT a');
      await expect(client.query(`UPDATE audit_log SET action = 'forged' WHERE id = $1`, [id])).rejects.toMatchObject({ code: '42501' });
      await client.query('ROLLBACK TO SAVEPOINT a');
      await expect(client.query(`DELETE FROM audit_log WHERE id = $1`, [id])).rejects.toMatchObject({ code: '42501' });
    } finally {
      await client.query('ROLLBACK').catch(() => undefined);
      client.release();
    }
  });
});
