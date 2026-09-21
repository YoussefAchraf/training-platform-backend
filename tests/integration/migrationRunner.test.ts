import fs from 'fs';
import os from 'os';
import path from 'path';
import { Pool } from 'pg';
import {
  loadMigrations,
  MigrationError,
  migrateUp,
  reconcileRuntimePrivileges,
  migrationStatus,
  planMigrations,
  verifyPromotion,
} from '../../src/infrastructure/database/migrationRunner';

const adminUrl = process.env.TEST_ADMIN_DATABASE_URL || process.env.MIGRATOR_DATABASE_URL || process.env.DATABASE_URL;
const quiet = { log: () => undefined, warn: () => undefined };

const suffix = `${process.pid}_${Date.now()}`;
const schemaOf = (name: string) => `migtest_${name}_${suffix}`;

describe('migration runner (real database, throwaway schemas)', () => {
  const admin = new Pool({ connectionString: adminUrl, max: 2 });
  const pools: Pool[] = [];
  const dirs: string[] = [];
  const schemas: string[] = [];

  async function scratch(name: string): Promise<Pool> {
    const schema = schemaOf(name);
    await admin.query(`CREATE SCHEMA ${schema}`);
    schemas.push(schema);
    const pool = new Pool({ connectionString: adminUrl, options: `-c search_path=${schema}`, max: 4 });
    pools.push(pool);
    return pool;
  }

  function migrationsDir(files: Record<string, string>): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'runner-test-'));
    dirs.push(dir);
    for (const [name, sql] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), sql);
    return dir;
  }

  beforeAll(async () => {
    const stale = await admin.query("SELECT nspname FROM pg_namespace WHERE nspname LIKE 'migtest!_%' ESCAPE '!'");
    const cutoff = Date.now() - 10 * 60 * 1000;
    for (const { nspname } of stale.rows) {
      const startedAt = Number(nspname.split('_').pop());
      if (Number.isFinite(startedAt) && startedAt < cutoff) await admin.query(`DROP SCHEMA IF EXISTS ${nspname} CASCADE`);
    }
  });

  afterAll(async () => {
    await Promise.all(pools.map((pool) => pool.end()));
    for (const schema of schemas) await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
    for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('applies migrations in order, records checksums, and is a no-op on re-run', async () => {
    const pool = await scratch('basic');
    const files = loadMigrations(
      migrationsDir({
        '0001_create_a.sql': 'CREATE TABLE a (id serial PRIMARY KEY, name text);',
        '0002_seed_a.sql': "INSERT INTO a (name) VALUES ('x');",
      })
    );

    const first = await migrateUp(pool, files, { logger: quiet });
    expect(first.applied.map((m) => m.version)).toEqual([1, 2]);
    const second = await migrateUp(pool, files, { logger: quiet });
    expect(second.applied).toEqual([]);

    const { rows } = await pool.query('SELECT version, checksum FROM schema_migrations ORDER BY version');
    expect(rows.map((r) => r.version)).toEqual([1, 2]);
    expect(rows[0].checksum.trim()).toBe(files[0].checksum);
    expect((await pool.query('SELECT count(*)::int AS n FROM a')).rows[0].n).toBe(1);
  });

  it('rolls a failing migration back completely and leaves earlier ones applied', async () => {
    const pool = await scratch('rollback');
    const files = loadMigrations(
      migrationsDir({
        '0001_ok.sql': 'CREATE TABLE ok_table (id int);',
        '0002_bad.sql': 'CREATE TABLE half_done (id int); SELECT 1/0;',
      })
    );

    await expect(migrateUp(pool, files, { logger: quiet })).rejects.toThrow(/division by zero/);
    expect((await pool.query("SELECT to_regclass('half_done') AS t")).rows[0].t).toBeNull();
    expect((await pool.query('SELECT version FROM schema_migrations')).rows.map((r) => r.version)).toEqual([1]);
  });

  it('refuses to run when an already-applied migration file was edited', async () => {
    const pool = await scratch('checksum');
    const dir = migrationsDir({ '0001_a.sql': 'CREATE TABLE t (id int);' });
    await migrateUp(pool, loadMigrations(dir), { logger: quiet });

    fs.writeFileSync(path.join(dir, '0001_a.sql'), 'CREATE TABLE t (id int, extra int);');
    await expect(migrateUp(pool, loadMigrations(dir), { logger: quiet })).rejects.toThrow(MigrationError);
  });

  it('ignores comment-only and whitespace-only edits (checksum is normalized)', async () => {
    const pool = await scratch('normalized');
    const dir = migrationsDir({ '0001_a.sql': 'CREATE TABLE t (id int);' });
    await migrateUp(pool, loadMigrations(dir), { logger: quiet });

    fs.writeFileSync(path.join(dir, '0001_a.sql'), '-- now with a comment\r\nCREATE TABLE t (id int); -- trailing\r\n\r\n');
    const result = await migrateUp(pool, loadMigrations(dir), { logger: quiet });
    expect(result.applied).toEqual([]);
  });

  it('gates destructive migrations behind ALLOW_DESTRUCTIVE_MIGRATIONS and applies nothing when blocked', async () => {
    const pool = await scratch('destructive');
    const files = loadMigrations(
      migrationsDir({
        '0001_a.sql': 'CREATE TABLE d (id int);',
        '0002_drop_d.destructive.sql': 'DROP TABLE d;',
      })
    );

    await expect(migrateUp(pool, files, { logger: quiet })).rejects.toThrow(/destructive/);
    expect((await pool.query("SELECT to_regclass('d') AS t")).rows[0].t).toBeNull();
    expect((await pool.query('SELECT count(*)::int AS n FROM schema_migrations')).rows[0].n).toBe(0);

    await migrateUp(pool, files, { logger: quiet, allowDestructive: true });
    expect((await pool.query('SELECT count(*)::int AS n FROM schema_migrations')).rows[0].n).toBe(2);
  });

  it('runs .notx migrations outside a transaction so CREATE INDEX CONCURRENTLY works', async () => {
    const pool = await scratch('notx');
    const files = loadMigrations(
      migrationsDir({
        '0001_table.sql': 'CREATE TABLE n (id serial PRIMARY KEY, email text);',
        '0002_index.notx.sql': 'CREATE INDEX CONCURRENTLY IF NOT EXISTS n_email_idx ON n (email);',
      })
    );
    await migrateUp(pool, files, { logger: quiet });
    const { rows } = await pool.query(
      `SELECT indisvalid FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE c.relname = 'n_email_idx' AND c.relnamespace = current_schema()::regnamespace`
    );
    expect(rows).toEqual([{ indisvalid: true }]);
  });

  it('serializes concurrent runners so each migration is applied exactly once', async () => {
    const pool = await scratch('lock');
    const files = loadMigrations(
      migrationsDir({
        '0001_a.sql': 'CREATE TABLE c (id int); SELECT pg_sleep(0.5);',
        '0002_b.sql': 'ALTER TABLE c ADD COLUMN v int;',
      })
    );
    const results = await Promise.all([
      migrateUp(pool, files, { logger: quiet }),
      migrateUp(pool, files, { logger: quiet }),
      migrateUp(pool, files, { logger: quiet }),
    ]);
    expect(results.reduce((sum, r) => sum + r.applied.length, 0)).toBe(2);
  });

  it('plan is read-only: it does not create the tracking table, and --verify rolls everything back', async () => {
    const pool = await scratch('plan');
    const files = loadMigrations(migrationsDir({ '0001_a.sql': 'CREATE TABLE p (id int);' }));

    const plain = await planMigrations(pool, files, { logger: quiet });
    expect(plain.pending).toHaveLength(1);
    const verified = await planMigrations(pool, files, { logger: quiet, verify: true });
    expect(verified.verified).toEqual(['0001_a.sql']);

    expect((await pool.query("SELECT to_regclass('schema_migrations') AS t")).rows[0].t).toBeNull();
    expect((await pool.query("SELECT to_regclass('p') AS t")).rows[0].t).toBeNull();
  });

  it('plan --verify surfaces SQL errors before anything is applied', async () => {
    const pool = await scratch('planfail');
    const files = loadMigrations(migrationsDir({ '0001_bad.sql': 'CREATE TABLE q (id int); ALTER TABLE nope ADD COLUMN x int;' }));
    await expect(planMigrations(pool, files, { logger: quiet, verify: true })).rejects.toThrow(/nope/);
  });

  it('status reports applied and pending migrations', async () => {
    const pool = await scratch('status');
    const dir = migrationsDir({ '0001_a.sql': 'CREATE TABLE s (id int);' });
    await migrateUp(pool, loadMigrations(dir), { logger: quiet });
    fs.writeFileSync(path.join(dir, '0002_b.sql'), 'ALTER TABLE s ADD COLUMN v int;');

    const rows = await migrationStatus(pool, loadMigrations(dir), { logger: quiet });
    expect(rows.map((r) => [r.version, r.state])).toEqual([
      [1, 'applied'],
      [2, 'pending'],
    ]);
  });

  it('reconciles the runtime role: audit_log becomes append-only with column-limited UPDATE and the migration history is hidden', async () => {
    const can = await admin.query('SELECT (rolsuper OR rolcreaterole) AS ok FROM pg_roles WHERE rolname = current_user');
    if (!can.rows[0].ok) return;
    const role = `migtest_rt_${process.pid}_${Date.now()}`;
    const pool = await scratch('privileges');
    await admin.query(`CREATE ROLE ${role}`);
    try {
      await pool.query(`CREATE TABLE audit_log (id serial PRIMARY KEY, action text, before jsonb, after jsonb, actor_deleted boolean DEFAULT false)`);
      await migrateUp(pool, loadMigrations(migrationsDir({ '0001_a.sql': 'SELECT 1;' })), { logger: quiet });
      await pool.query('CREATE TABLE ordinary_table (id serial PRIMARY KEY, note text)');
      await reconcileRuntimePrivileges(pool, role, quiet);
      const has = async (table: string, privilege: string) => (await pool.query('SELECT has_table_privilege($1, $2, $3) AS p', [role, table, privilege])).rows[0].p;
      const hasColumn = async (column: string) => (await pool.query("SELECT has_column_privilege($1, 'audit_log', $2, 'UPDATE') AS p", [role, column])).rows[0].p;
      expect(await has('ordinary_table', 'SELECT')).toBe(true);
      expect(await has('ordinary_table', 'DELETE')).toBe(true);
      expect(await has('ordinary_table', 'TRUNCATE')).toBe(false);
      await pool.query('CREATE TABLE created_later (id serial PRIMARY KEY)');
      expect(await has('created_later', 'INSERT')).toBe(true);
      expect(await has('audit_log', 'SELECT')).toBe(true);
      expect(await has('audit_log', 'INSERT')).toBe(true);
      expect(await has('audit_log', 'DELETE')).toBe(false);
      expect(await has('audit_log', 'TRUNCATE')).toBe(false);
      expect(await has('audit_log', 'UPDATE')).toBe(false);
      expect(await hasColumn('actor_deleted')).toBe(true);
      expect(await hasColumn('before')).toBe(true);
      expect(await hasColumn('after')).toBe(true);
      expect(await hasColumn('action')).toBe(false);
      expect(await has('schema_migrations', 'SELECT')).toBe(false);
      await expect(reconcileRuntimePrivileges(pool, 'bad role; DROP', quiet)).rejects.toThrow(/Invalid runtime role/);
    } finally {
      await admin.query(`DROP OWNED BY ${role}`).catch(() => undefined);
      await admin.query(`DROP ROLE IF EXISTS ${role}`);
    }
  });

  it('promotion gate blocks migrations that were not proven on the source (dev) database', async () => {
    const dev = await scratch('promo_dev');
    const prod = await scratch('promo_prod');
    const dir = migrationsDir({ '0001_a.sql': 'CREATE TABLE g (id int);' });
    const v1 = loadMigrations(dir);
    await migrateUp(dev, v1, { logger: quiet });
    await migrateUp(prod, v1, { logger: quiet });

    fs.writeFileSync(path.join(dir, '0002_b.sql'), 'ALTER TABLE g ADD COLUMN v int;');
    const v2 = loadMigrations(dir);

    await expect(verifyPromotion(prod, dev, v2, { logger: quiet })).rejects.toThrow(/Promotion blocked/);
    await migrateUp(dev, v2, { logger: quiet });
    const promotable = await verifyPromotion(prod, dev, v2, { logger: quiet });
    expect(promotable.map((m) => m.version)).toEqual([2]);
  });
});
