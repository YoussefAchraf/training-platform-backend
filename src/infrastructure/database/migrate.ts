import 'dotenv/config';
import path from 'path';
import { Pool } from 'pg';
import { lintMigrations } from './migrationLint';
import {
  loadMigrations,
  migrateUp,
  migrationStatus,
  planMigrations,
  reconcileRuntimePrivileges,
  verifyPromotion,
} from './migrationRunner';

const USAGE = `Usage: migrate [command] [options]

Commands:
  up (default)     Apply pending migrations, then reconcile runtime privileges
  status           Show applied / pending migrations (read-only)
  plan [--verify]  List pending migrations; --verify also executes them in a rolled-back transaction
  promote-check    Verify every pending migration was already applied (same checksum) on the dev database
  lint             Static safety checks on the migration files (no database needed)

Environment:
  MIGRATOR_DATABASE_URL | DATABASE_URL    target database
  ALLOW_DESTRUCTIVE_MIGRATIONS=true       permit *.destructive.sql migrations
  APP_RUNTIME_ROLE                        runtime role whose privileges are reconciled after 'up'
  PROMOTION_SOURCE_DATABASE_URL           dev database; when set, 'up' refuses migrations not proven there
  MIGRATIONS_DIR                          override the migrations directory
`;

const describe = (url: string) => {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}:${parsed.port || '5432'}${parsed.pathname}`;
  } catch {
    return '(unparseable connection string)';
  }
};

async function main() {
  const args = process.argv.slice(2);
  const command = args.find((arg) => !arg.startsWith('--')) ?? 'up';
  const migrationsDir = process.env.MIGRATIONS_DIR || path.join(__dirname, 'migrations');

  if (args.includes('--help') || command === 'help') {
    console.log(USAGE);
    return;
  }

  const files = loadMigrations(migrationsDir);

  if (command === 'lint') {
    const issues = lintMigrations(files);
    for (const issue of issues) console.error(`${issue.file} [${issue.rule}] ${issue.message}`);
    if (issues.length > 0) {
      process.exitCode = 1;
      return;
    }
    console.log(`Linted ${files.length} migration(s): no issues.`);
    return;
  }

  const connectionString = process.env.MIGRATOR_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Set MIGRATOR_DATABASE_URL (or DATABASE_URL) to the target database.');
  }
  const allowDestructive = process.env.ALLOW_DESTRUCTIVE_MIGRATIONS === 'true';
  const pool = new Pool({ connectionString });
  const sourceUrl = process.env.PROMOTION_SOURCE_DATABASE_URL;
  const sourcePool = sourceUrl ? new Pool({ connectionString: sourceUrl }) : null;

  try {
    console.log(`Target database: ${describe(connectionString)}`);

    if (command === 'status') {
      const rows = await migrationStatus(pool, files);
      for (const row of rows) {
        const when = row.appliedAt ? ` ${row.appliedAt.toISOString()}` : '';
        console.log(`${String(row.version).padStart(4, '0')}  ${row.state.padEnd(12)}  ${row.name}${when}`);
      }
      return;
    }

    if (command === 'plan') {
      await planMigrations(pool, files, { allowDestructive: true, verify: args.includes('--verify') });
      return;
    }

    if (command === 'promote-check') {
      if (!sourcePool) throw new Error('Set PROMOTION_SOURCE_DATABASE_URL to the dev database.');
      console.log(`Source (dev) database: ${describe(sourceUrl as string)}`);
      await verifyPromotion(pool, sourcePool, files);
      return;
    }

    if (command !== 'up') {
      console.error(USAGE);
      process.exitCode = 1;
      return;
    }

    if (sourcePool) {
      console.log(`Promotion gate: checking pending migrations against ${describe(sourceUrl as string)}`);
      await verifyPromotion(pool, sourcePool, files);
    }
    await migrateUp(pool, files, { allowDestructive });
    if (process.env.APP_RUNTIME_ROLE) {
      await reconcileRuntimePrivileges(pool, process.env.APP_RUNTIME_ROLE);
    }
    console.log('Migration complete.');
  } finally {
    await pool.end();
    if (sourcePool) await sourcePool.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exitCode = 1;
});
