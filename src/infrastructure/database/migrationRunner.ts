import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { Pool, PoolClient } from 'pg';
import { splitStatements } from './sqlScanner';

export const MIGRATION_LOCK_KEY = 7263948101;
export const MIGRATIONS_TABLE = 'schema_migrations';

const MIGRATION_FILE_RE = /^(\d{4})_([a-z0-9]+(?:_[a-z0-9]+)*)((?:\.(?:notx|destructive))*)\.sql$/;

export interface MigrationFile {
  version: number;
  name: string;
  filename: string;
  noTransaction: boolean;
  destructive: boolean;
  sql: string;
  checksum: string;
}

export interface AppliedMigration {
  version: number;
  name: string;
  checksum: string;
  applied_at: Date;
  applied_by: string;
  execution_ms: number;
}

export interface Logger {
  log: (message: string) => void;
  warn: (message: string) => void;
}

export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MigrationError';
  }
}

export function stripLineComments(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      let inSingle = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === "'") {
          if (inSingle && line[i + 1] === "'") {
            i++;
            continue;
          }
          inSingle = !inSingle;
        } else if (!inSingle && ch === '-' && line[i + 1] === '-') {
          return line.slice(0, i).replace(/\s+$/, '');
        }
      }
      return line;
    })
    .join('\n');
}

export function normalizeSql(raw: string): string {
  const lf = (raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw).replace(/\r\n?/g, '\n');
  return (
    stripLineComments(lf)
      .split('\n')
      .map((line) => line.replace(/\s+$/, ''))
      .filter((line) => line.length > 0)
      .join('\n') + '\n'
  );
}

export function checksumOf(normalizedSql: string): string {
  return crypto.createHash('sha256').update(normalizedSql, 'utf8').digest('hex');
}

export function parseMigrationFilename(filename: string) {
  const match = MIGRATION_FILE_RE.exec(filename);
  if (!match) return null;
  const flags = match[3].split('.').filter(Boolean);
  if (new Set(flags).size !== flags.length) return null;
  return {
    version: Number(match[1]),
    name: match[2],
    noTransaction: flags.includes('notx'),
    destructive: flags.includes('destructive'),
  };
}

export function loadMigrations(dir: string): MigrationFile[] {
  if (!fs.existsSync(dir)) {
    throw new MigrationError(`Migrations directory not found: ${dir}`);
  }
  const migrations: MigrationFile[] = [];
  for (const filename of fs.readdirSync(dir).sort()) {
    if (!filename.endsWith('.sql')) continue;
    const parsed = parseMigrationFilename(filename);
    if (!parsed) {
      throw new MigrationError(
        `Invalid migration filename "${filename}". Expected NNNN_snake_case_name[.notx][.destructive].sql`
      );
    }
    const sql = normalizeSql(fs.readFileSync(path.join(dir, filename), 'utf8'));
    migrations.push({ ...parsed, filename, sql, checksum: checksumOf(sql) });
  }
  migrations.sort((a, b) => a.version - b.version);

  for (let i = 0; i < migrations.length; i++) {
    if (migrations[i].version !== i + 1) {
      throw new MigrationError(
        `Migration versions must be sequential starting at 0001 with no gaps or duplicates; ` +
          `expected ${String(i + 1).padStart(4, '0')} but found ${migrations[i].filename}`
      );
    }
  }
  return migrations;
}

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
    version      integer     PRIMARY KEY CHECK (version > 0),
    name         text        NOT NULL,
    checksum     char(64)    NOT NULL,
    applied_at   timestamptz NOT NULL DEFAULT now(),
    applied_by   text        NOT NULL DEFAULT current_user,
    execution_ms integer     NOT NULL CHECK (execution_ms >= 0)
  )`;

async function acquireLock(client: PoolClient, waitMs: number, logger: Logger) {
  const started = Date.now();
  let announced = false;
  for (;;) {
    const { rows } = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [MIGRATION_LOCK_KEY]);
    if (rows[0].locked) return;
    if (Date.now() - started >= waitMs) {
      throw new MigrationError(`Could not acquire the migration lock within ${waitMs} ms; another migration is running.`);
    }
    if (!announced) {
      logger.log('Another migration run holds the lock; waiting...');
      announced = true;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

async function releaseLock(client: PoolClient) {
  try {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
  } catch {
    
  }
}

async function readApplied(client: PoolClient): Promise<AppliedMigration[]> {
  const exists = await client.query('SELECT to_regclass($1) AS t', [MIGRATIONS_TABLE]);
  if (!exists.rows[0].t) return [];
  const { rows } = await client.query(
    `SELECT version, name, checksum, applied_at, applied_by, execution_ms FROM ${MIGRATIONS_TABLE} ORDER BY version`
  );
  return rows;
}

export interface Reconciliation {
  applied: AppliedMigration[];
  pending: MigrationFile[];
  missingFiles: AppliedMigration[];
}

export function reconcile(files: MigrationFile[], applied: AppliedMigration[]): Reconciliation {
  const appliedByVersion = new Map(applied.map((row) => [row.version, row]));
  const fileByVersion = new Map(files.map((file) => [file.version, file]));

  for (const row of applied) {
    const file = fileByVersion.get(row.version);
    if (file && file.checksum.trim() !== row.checksum.trim()) {
      throw new MigrationError(
        `Migration ${file.filename} was already applied but its contents have changed ` +
          `(applied checksum ${row.checksum.slice(0, 12)}..., file checksum ${file.checksum.slice(0, 12)}...). ` +
          `Applied migrations are immutable; add a new migration instead.`
      );
    }
  }

  const pending = files.filter((file) => !appliedByVersion.has(file.version));
  const maxApplied = applied.reduce((max, row) => Math.max(max, row.version), 0);
  const outOfOrder = pending.filter((file) => file.version < maxApplied);
  if (outOfOrder.length > 0) {
    throw new MigrationError(
      `Out-of-order migration(s) detected: ${outOfOrder.map((m) => m.filename).join(', ')} ` +
        `are older than the newest applied migration (${maxApplied}). Renumber them after the latest version.`
    );
  }

  const missingFiles = applied.filter((row) => !fileByVersion.has(row.version));
  return { applied, pending, missingFiles };
}

function assertDestructiveAllowed(pending: MigrationFile[], allowDestructive: boolean) {
  const blocked = pending.filter((m) => m.destructive);
  if (blocked.length > 0 && !allowDestructive) {
    throw new MigrationError(
      `Refusing to apply destructive migration(s): ${blocked.map((m) => m.filename).join(', ')}. ` +
        `Review them, take a backup, then re-run with ALLOW_DESTRUCTIVE_MIGRATIONS=true.`
    );
  }
}

async function findInvalidIndexes(client: PoolClient): Promise<string[]> {
  const { rows } = await client.query(
    `SELECT c.relname FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE NOT i.indisvalid AND n.nspname = current_schema()`
  );
  return rows.map((row) => row.relname);
}

async function recordApplied(client: PoolClient, migration: MigrationFile, executionMs: number) {
  await client.query(
    `INSERT INTO ${MIGRATIONS_TABLE} (version, name, checksum, execution_ms) VALUES ($1, $2, $3, $4)`,
    [migration.version, migration.name, migration.checksum, executionMs]
  );
}

async function applyOne(client: PoolClient, migration: MigrationFile, lockTimeoutMs: number, logger: Logger) {
  const started = Date.now();
  const timeout = `${Math.max(0, Math.floor(lockTimeoutMs))}ms`;

  if (migration.noTransaction) {
    await client.query(`SET lock_timeout = '${timeout}'`);
    try {
      for (const statement of splitStatements(migration.sql)) {
        await client.query(statement);
      }
    } finally {
      await client.query('RESET lock_timeout');
    }
    const invalid = await findInvalidIndexes(client);
    if (invalid.length > 0) {
      throw new MigrationError(
        `${migration.filename} left INVALID index(es): ${invalid.join(', ')}. ` +
          `Run DROP INDEX CONCURRENTLY <name> for each and re-run the migration.`
      );
    }
    await recordApplied(client, migration, Date.now() - started);
  } else {
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL lock_timeout = '${timeout}'`);
      await client.query(migration.sql);
      await recordApplied(client, migration, Date.now() - started);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    }
  }
  logger.log(`Applied ${migration.filename} (${Date.now() - started} ms)`);
}

export interface RunOptions {
  allowDestructive?: boolean;
  lockWaitMs?: number;
  lockTimeoutMs?: number;
  logger?: Logger;
}

const defaultLogger: Logger = { log: (m) => console.log(m), warn: (m) => console.warn(m) };

async function withLockedClient<T>(
  pool: Pool,
  options: RunOptions,
  fn: (client: PoolClient, logger: Logger) => Promise<T>,
  { createTable }: { createTable: boolean }
) {
  const logger = options.logger ?? defaultLogger;
  const client = await pool.connect();
  try {
    await acquireLock(client, options.lockWaitMs ?? 60000, logger);
    try {
      if (createTable) await client.query(CREATE_TABLE_SQL);
      return await fn(client, logger);
    } finally {
      await releaseLock(client);
    }
  } finally {
    client.release();
  }
}

export async function migrateUp(pool: Pool, files: MigrationFile[], options: RunOptions = {}) {
  return withLockedClient(pool, options, async (client, logger) => {
    const state = reconcile(files, await readApplied(client));
    for (const row of state.missingFiles) {
      logger.warn(`Database has migration ${row.version} (${row.name}) that this build does not contain (newer schema than this code).`);
    }
    assertDestructiveAllowed(state.pending, options.allowDestructive === true);

    if (state.pending.length === 0) {
      logger.log(`Database is up to date (${state.applied.length} migration(s) applied).`);
      return { applied: [] as MigrationFile[] };
    }
    logger.log(`Applying ${state.pending.length} pending migration(s)...`);
    const applied: MigrationFile[] = [];
    for (const migration of state.pending) {
      await applyOne(client, migration, options.lockTimeoutMs ?? 30000, logger);
      applied.push(migration);
    }
    return { applied };
  }, { createTable: true });
}

export async function planMigrations(pool: Pool, files: MigrationFile[], options: RunOptions & { verify?: boolean } = {}) {
  return withLockedClient(pool, options, async (client, logger) => {
    const state = reconcile(files, await readApplied(client));
    assertDestructiveAllowed(state.pending, options.allowDestructive === true);

    if (state.pending.length === 0) {
      logger.log('Nothing to apply.');
      return { pending: [] as MigrationFile[], verified: [] as string[] };
    }
    for (const migration of state.pending) {
      logger.log(`Pending: ${migration.filename}${migration.noTransaction ? ' (no-transaction)' : ''}${migration.destructive ? ' (DESTRUCTIVE)' : ''}`);
    }
    if (!options.verify) return { pending: state.pending, verified: [] as string[] };

    const verified: string[] = [];
    try {
      await client.query('BEGIN');
      for (const migration of state.pending) {
        const sql = migration.noTransaction ? migration.sql.replace(/\bCONCURRENTLY\b/gi, '') : migration.sql;
        await client.query(sql);
        verified.push(migration.filename);
      }
    } finally {
      await client.query('ROLLBACK').catch(() => undefined);
    }
    for (const filename of verified) logger.log(`Verified (executed then rolled back): ${filename}`);
    return { pending: state.pending, verified };
  }, { createTable: false });
}

export type MigrationState = 'applied' | 'pending' | 'missing-file';

export interface StatusRow {
  version: number;
  name: string;
  state: MigrationState;
  appliedAt?: Date;
}

export async function migrationStatus(pool: Pool, files: MigrationFile[], options: RunOptions = {}): Promise<StatusRow[]> {
  return withLockedClient(pool, options, async (client) => {
    const state = reconcile(files, await readApplied(client));
    const rows: StatusRow[] = state.applied.map((row) => ({
      version: row.version,
      name: row.name,
      state: files.some((file) => file.version === row.version) ? ('applied' as const) : ('missing-file' as const),
      appliedAt: row.applied_at,
    }));
    for (const file of state.pending) rows.push({ version: file.version, name: file.name, state: 'pending' });
    return rows.sort((a, b) => a.version - b.version);
  }, { createTable: false });
}

export async function verifyPromotion(targetPool: Pool, sourcePool: Pool, files: MigrationFile[], options: RunOptions = {}) {
  const logger = options.logger ?? defaultLogger;
  const targetClient = await targetPool.connect();
  let targetApplied: AppliedMigration[] = [];
  try {
    targetApplied = await readApplied(targetClient);
  } finally {
    targetClient.release();
  }
  const pending = reconcile(files, targetApplied).pending;

  const sourceClient = await sourcePool.connect();
  let sourceApplied: AppliedMigration[] = [];
  try {
    sourceApplied = await readApplied(sourceClient);
  } finally {
    sourceClient.release();
  }
  const sourceByVersion = new Map(sourceApplied.map((row) => [row.version, row]));

  const unproven = pending.filter((migration) => {
    const onSource = sourceByVersion.get(migration.version);
    return !onSource || onSource.checksum.trim() !== migration.checksum;
  });
  if (unproven.length > 0) {
    throw new MigrationError(
      `Promotion blocked: ${unproven.map((m) => m.filename).join(', ')} ` +
        `not applied (with an identical checksum) on the source/dev database. Apply and test on dev first.`
    );
  }
  for (const migration of pending) logger.log(`Promotable: ${migration.filename} (verified on the source database)`);
  if (pending.length === 0) logger.log('No pending migrations to promote.');
  return pending;
}

const ROLE_NAME_RE = /^[a-z_][a-z0-9_]*$/;

export async function reconcileRuntimePrivileges(pool: Pool, runtimeRole: string, logger: Logger = defaultLogger) {
  if (!ROLE_NAME_RE.test(runtimeRole)) {
    throw new MigrationError(`Invalid runtime role name: ${runtimeRole}`);
  }
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [runtimeRole]);
    if (rows.length === 0) {
      logger.warn(`Runtime role "${runtimeRole}" does not exist; skipping privilege reconciliation.`);
      return;
    }
    const tracking = await client.query('SELECT to_regclass($1) AS t', [MIGRATIONS_TABLE]);
    if (tracking.rows[0].t) {
      await client.query(`REVOKE ALL ON ${MIGRATIONS_TABLE} FROM ${runtimeRole}`);
    }
    const audit = await client.query('SELECT to_regclass($1) AS t', ['audit_log']);
    if (audit.rows[0].t) {
      await client.query(`REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM ${runtimeRole}`);
      await client.query(`GRANT SELECT, INSERT ON audit_log TO ${runtimeRole}`);
      await client.query(`GRANT UPDATE ("actor_deleted", "before", "after") ON audit_log TO ${runtimeRole}`);
    }
    logger.log(`Reconciled privileges for role "${runtimeRole}" (schema_migrations hidden, audit_log append-only).`);
  } finally {
    client.release();
  }
}
