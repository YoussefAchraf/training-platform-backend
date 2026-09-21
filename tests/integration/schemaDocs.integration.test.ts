import { Pool } from 'pg';
import { introspectSchema, renderMermaid, renderReference } from '../../src/infrastructure/database/schemaDocs';

describe('schema introspection (real database)', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

  afterAll(async () => {
    await pool.end();
  });

  it('reads tables, keys, checks, indexes, triggers, enums and comments from the catalog', async () => {
    const schema = await introspectSchema(pool, []);
    const byName = new Map(schema.tables.map((t) => [t.name, t]));

    expect(schema.tables.map((t) => t.name)).toEqual(expect.arrayContaining(['users', 'training_sessions', 'messages', 'feature_announcement_target_roles']));
    expect(byName.has('schema_migrations')).toBe(false);

    const users = byName.get('users')!;
    expect(users.primaryKey).toEqual(['id']);
    expect(users.comment).toMatch(/Every account/);
    expect(users.indexes.map((i) => i.name)).toContain('users_email_lower_key');
    expect(users.checks.map((c) => c.name)).toEqual(expect.arrayContaining(['ck_users_email_format']));

    const sessions = byName.get('training_sessions')!;
    expect(sessions.foreignKeys.find((fk) => fk.refTable === 'trainings')?.onDelete).toBe('NO ACTION');
    expect(sessions.foreignKeys.find((fk) => fk.refTable === 'instructors')?.onDelete).toBe('SET NULL');
    expect(sessions.indexes.find((i) => i.name === 'training_sessions_instructor_start_key')).toMatchObject({ unique: true, partial: true });

    const messages = byName.get('messages')!;
    expect(messages.foreignKeys.find((fk) => fk.name === 'fk_messages_reply_same_conversation')?.onDelete).toBe('SET NULL (reply_to_message_id)');

    expect(byName.get('feature_announcements')!.triggers.map((t) => t.name)).toContain('trg_sync_announcement_target_roles');
    expect(schema.enums.find((e) => e.name === 'session_status')?.values).toEqual(['scheduled', 'ongoing', 'completed', 'cancelled']);
    expect(schema.functions).toContain('sync_announcement_target_roles');

    for (const table of schema.tables) {
      expect(table.comment).toBeTruthy();
      expect(table.primaryKey.length).toBeGreaterThan(0);
    }
  });

  it('is deterministic and the ERD relates the central tables', async () => {
    const first = await introspectSchema(pool, []);
    const second = await introspectSchema(pool, []);
    expect(renderReference(first)).toBe(renderReference(second));
    const erd = renderMermaid(first);
    expect(erd).toContain('training_sessions ||..o{ session_attendees : "session_id"');
    expect(erd).toContain('users o|..o{ audit_log : "actor_id"');
  });
});
