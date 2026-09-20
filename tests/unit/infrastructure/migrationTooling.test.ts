import fs from 'fs';
import os from 'os';
import path from 'path';
import { lintMigration, lintMigrations } from '../../../src/infrastructure/database/migrationLint';
import {
  checksumOf,
  loadMigrations,
  normalizeSql,
  parseMigrationFilename,
  reconcile,
} from '../../../src/infrastructure/database/migrationRunner';
import type { MigrationFile } from '../../../src/infrastructure/database/migrationRunner';
import { codeOnly, scanSql, splitStatements } from '../../../src/infrastructure/database/sqlScanner';

function fakeMigration(sql: string, overrides: Partial<MigrationFile> = {}): MigrationFile {
  const normalized = normalizeSql(sql);
  return {
    version: 2,
    name: 'test',
    filename: '0002_test.sql',
    noTransaction: false,
    destructive: false,
    sql: normalized,
    checksum: checksumOf(normalized),
    ...overrides,
  };
}

const rules = (file: MigrationFile) => lintMigration(file).map((issue) => issue.rule);

describe('sqlScanner', () => {
  it('splits statements on top-level semicolons only', () => {
    const sql = `CREATE TABLE a (x int); DO $$ BEGIN PERFORM 1; PERFORM 2; END $$; SELECT ';' ;`;
    expect(splitStatements(sql)).toHaveLength(3);
  });

  it('ignores semicolons in comments, quoted identifiers and tagged dollar quotes', () => {
    const sql = `-- a; b\nSELECT "we;ird"; /* x; y */ SELECT $f$ a; b $f$;`;
    expect(splitStatements(sql)).toEqual(['SELECT "we;ird"', 'SELECT $f$ a; b $f$']);
  });

  it('handles doubled quotes inside string literals', () => {
    expect(splitStatements(`SELECT 'it''s; fine'; SELECT 2`)).toHaveLength(2);
  });

  it('codeOnly blanks strings and comments but scans dollar-quoted bodies as code', () => {
    const code = codeOnly(`SELECT 'DROP TABLE x'; DO $$ BEGIN DELETE FROM t; END $$`);
    expect(code).not.toMatch(/DROP TABLE/);
    expect(code).toMatch(/DELETE FROM t/);
  });

  it('classifies segments', () => {
    const kinds = scanSql(`SELECT 'a', "b" -- c`).map((s) => s.kind);
    expect(kinds).toEqual(['code', 'string', 'code', 'identifier', 'code', 'comment']);
  });
});

describe('normalizeSql / checksumOf', () => {
  it('is identical for a commented working copy and the comment-stripped git copy', () => {
    const working = `-- header\r\nCREATE TABLE a (\r\n  id int -- pk\r\n);\r\n\r\n  -- trailing\r\n`;
    const committed = `\nCREATE TABLE a (\n  id int\n);\n\n\n`;
    expect(normalizeSql(working)).toBe(normalizeSql(committed));
    expect(checksumOf(normalizeSql(working))).toBe(checksumOf(normalizeSql(committed)));
  });

  it('keeps -- inside single-quoted strings', () => {
    expect(normalizeSql(`SELECT 'a--b'; -- gone`)).toBe(`SELECT 'a--b';\n`);
  });

  it('changes when the SQL meaningfully changes', () => {
    expect(checksumOf(normalizeSql('SELECT 1;'))).not.toBe(checksumOf(normalizeSql('SELECT 2;')));
  });
});

describe('parseMigrationFilename', () => {
  it('parses flags', () => {
    expect(parseMigrationFilename('0004_add_index.notx.sql')).toMatchObject({ version: 4, noTransaction: true, destructive: false });
    expect(parseMigrationFilename('0005_drop_old.destructive.sql')).toMatchObject({ version: 5, destructive: true });
    expect(parseMigrationFilename('0006_x.notx.destructive.sql')).toMatchObject({ noTransaction: true, destructive: true });
  });

  it('rejects malformed names', () => {
    for (const bad of ['1_x.sql', '0001-x.sql', '0001_X.sql', '0001_x.notx.notx.sql', '0001_x.sql.bak', '0001_.sql']) {
      expect(parseMigrationFilename(bad)).toBeNull();
    }
  });
});

describe('loadMigrations', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migrations-test-'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('loads in order and enforces gapless numbering', () => {
    fs.writeFileSync(path.join(dir, '0002_b.sql'), 'SELECT 2;');
    fs.writeFileSync(path.join(dir, '0001_a.sql'), 'SELECT 1;');
    expect(loadMigrations(dir).map((m) => m.version)).toEqual([1, 2]);

    fs.writeFileSync(path.join(dir, '0004_d.sql'), 'SELECT 4;');
    expect(() => loadMigrations(dir)).toThrow(/sequential/);
  });

  it('rejects unexpected .sql filenames but ignores other files', () => {
    fs.writeFileSync(path.join(dir, '0001_a.sql'), 'SELECT 1;');
    fs.writeFileSync(path.join(dir, 'README.md'), 'docs');
    expect(loadMigrations(dir)).toHaveLength(1);
    fs.writeFileSync(path.join(dir, 'oops.sql'), 'SELECT 1;');
    expect(() => loadMigrations(dir)).toThrow(/Invalid migration filename/);
  });
});

describe('reconcile', () => {
  const a = fakeMigration('SELECT 1;', { version: 1, filename: '0001_a.sql', name: 'a' });
  const b = fakeMigration('SELECT 2;', { version: 2, filename: '0002_b.sql', name: 'b' });
  const row = (m: MigrationFile, checksum = m.checksum) => ({
    version: m.version,
    name: m.name,
    checksum,
    applied_at: new Date(),
    applied_by: 'x',
    execution_ms: 1,
  });

  it('reports pending migrations', () => {
    expect(reconcile([a, b], [row(a)]).pending.map((m) => m.version)).toEqual([2]);
  });

  it('fails when an applied migration file was edited', () => {
    expect(() => reconcile([a, b], [row(a, 'f'.repeat(64))])).toThrow(/immutable/);
  });

  it('fails on out-of-order pending migrations', () => {
    expect(() => reconcile([a, b], [row(b)])).toThrow(/Out-of-order/);
  });

  it('tolerates a database that is ahead of this build', () => {
    const result = reconcile([a], [row(a), row(b)]);
    expect(result.pending).toHaveLength(0);
    expect(result.missingFiles.map((m) => m.version)).toEqual([2]);
  });
});

describe('migration linter', () => {
  it('accepts safe additive changes', () => {
    const sql = `
      CREATE TABLE IF NOT EXISTS widget (id serial PRIMARY KEY, name text NOT NULL);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname text;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS flag boolean NOT NULL DEFAULT false;
      ALTER TABLE users ADD CONSTRAINT users_nick_len CHECK (char_length(nickname) < 50) NOT VALID;
      ALTER TABLE users VALIDATE CONSTRAINT users_nick_len;
    `;
    expect(lintMigration(fakeMigration(sql))).toEqual([]);
  });

  it('blocks data-touching and destructive statements unless marked .destructive', () => {
    const cases = [
      'UPDATE users SET status = 1;',
      'DELETE FROM users;',
      'TRUNCATE users;',
      'DROP TABLE users;',
      'ALTER TABLE users DROP COLUMN email;',
      'ALTER TABLE users ALTER COLUMN email TYPE text;',
      'ALTER TABLE users RENAME COLUMN email TO mail;',
      `DO $$ BEGIN UPDATE users SET x = 1; END $$;`,
    ];
    for (const sql of cases) {
      expect(rules(fakeMigration(sql))).toContain('destructive');
      expect(lintMigration(fakeMigration(sql, { destructive: true, filename: '0002_test.destructive.sql' }))).toEqual([]);
    }
  });

  it('does not confuse ON UPDATE / ON DELETE actions or GRANT-free harmless drops', () => {
    const sql = `
      CREATE TABLE child (id int, parent_id int REFERENCES parent(id) ON UPDATE CASCADE ON DELETE SET NULL);
      ALTER TABLE parent DROP CONSTRAINT IF EXISTS old_check;
      DROP INDEX IF EXISTS old_idx;
    `;
    expect(lintMigration(fakeMigration(sql))).toEqual([]);
  });

  it('requires NOT VALID for CHECK/FK on existing tables but not on tables created in the same file', () => {
    expect(rules(fakeMigration('ALTER TABLE users ADD CONSTRAINT c CHECK (id > 0);'))).toContain('constraint-not-valid');
    expect(rules(fakeMigration('ALTER TABLE users ADD CONSTRAINT f FOREIGN KEY (a) REFERENCES b(id);'))).toContain('constraint-not-valid');
    expect(
      lintMigration(fakeMigration('CREATE TABLE t (id int); ALTER TABLE t ADD CONSTRAINT c CHECK (id > 0);'))
    ).toEqual([]);
  });

  it('requires a default when adding NOT NULL columns to existing tables', () => {
    expect(rules(fakeMigration('ALTER TABLE users ADD COLUMN x int NOT NULL;'))).toContain('not-null-needs-default');
    expect(rules(fakeMigration('ALTER TABLE users ADD COLUMN x numeric(10,2) DEFAULT 0 NOT NULL;'))).toEqual([]);
  });

  it('requires CONCURRENTLY indexes to live in .notx migrations and be idempotent', () => {
    expect(rules(fakeMigration('CREATE INDEX idx ON users (email);'))).toContain('index-concurrently');
    expect(rules(fakeMigration('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx ON users (email);'))).toContain('concurrently-needs-notx');
    expect(rules(fakeMigration('CREATE INDEX CONCURRENTLY idx ON users (email);', { noTransaction: true }))).toContain('idempotent-index');
    expect(
      lintMigration(
        fakeMigration('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx ON users (email);', { noTransaction: true, filename: '0002_x.notx.sql' })
      )
    ).toEqual([]);
    expect(rules(fakeMigration('SELECT 1;', { noTransaction: true }))).toContain('notx-needs-reason');
  });

  it('forbids explicit transaction control and environment-specific privilege statements', () => {
    expect(rules(fakeMigration('BEGIN; SELECT 1; COMMIT;'))).toContain('no-tx-control');
    expect(rules(fakeMigration('GRANT SELECT ON users TO app_runtime;'))).toContain('no-privileges');
    expect(rules(fakeMigration('ALTER DEFAULT PRIVILEGES GRANT SELECT ON TABLES TO x;'))).toContain('no-privileges');
  });

  it('rejects multi-line string literals that normalization could alter', () => {
    expect(rules(fakeMigration("SELECT 'a\n\nb';"))).toContain('multiline-string');
  });

  it('lints every real migration in the repository', () => {
    const files = loadMigrations(path.join(__dirname, '../../../src/infrastructure/database/migrations'));
    expect(lintMigrations(files)).toEqual([]);
  });

  it('never lets the baseline mutate existing rows (it is adopted by databases that already hold data)', () => {
    const [baseline] = loadMigrations(path.join(__dirname, '../../../src/infrastructure/database/migrations'));
    expect(baseline.filename).toBe('0001_baseline.sql');
    const code = codeOnly(baseline.sql).replace(/\s+/g, ' ');
    expect(code).not.toMatch(/(?:^|;|\bBEGIN\b|\bTHEN\b|\bELSE\b)\s*(?:UPDATE|DELETE\s+FROM|TRUNCATE)\b/i);
    expect(code).not.toMatch(/\bDROP\s+(?:TABLE|COLUMN|SCHEMA|TYPE)\b/i);
  });
});
