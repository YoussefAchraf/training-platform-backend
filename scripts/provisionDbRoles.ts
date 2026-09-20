import 'dotenv/config';
import { Pool } from 'pg';
import { reconcileRuntimePrivileges } from '../src/infrastructure/database/migrationRunner';

const IDENTIFIER_RE = /^[a-z_][a-z0-9_]*$/;

async function provisionDbRoles() {
  const { DATABASE_URL, APP_RUNTIME_DB_PASSWORD, APP_MIGRATOR_DB_PASSWORD } = process.env;
  const runtimeRole = process.env.APP_RUNTIME_ROLE || 'app_runtime';
  const migratorRole = process.env.APP_MIGRATOR_ROLE || 'app_migrator';
  const createDatabaseIfMissing = process.env.CREATE_DATABASE_IF_MISSING === 'true';

  const missing = ['DATABASE_URL', 'APP_RUNTIME_DB_PASSWORD', 'APP_MIGRATOR_DB_PASSWORD'].filter(
    (key) => !process.env[key]
  );
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  if (APP_RUNTIME_DB_PASSWORD.length < 20 || APP_MIGRATOR_DB_PASSWORD.length < 20) {
    console.error('APP_RUNTIME_DB_PASSWORD and APP_MIGRATOR_DB_PASSWORD must be at least 20 characters');
    process.exitCode = 1;
    return;
  }
  if (APP_RUNTIME_DB_PASSWORD === APP_MIGRATOR_DB_PASSWORD) {
    console.error('APP_RUNTIME_DB_PASSWORD and APP_MIGRATOR_DB_PASSWORD must be different');
    process.exitCode = 1;
    return;
  }
  if (!IDENTIFIER_RE.test(runtimeRole) || !IDENTIFIER_RE.test(migratorRole) || runtimeRole === migratorRole) {
    console.error('APP_RUNTIME_ROLE and APP_MIGRATOR_ROLE must be different lowercase SQL identifiers');
    process.exitCode = 1;
    return;
  }

  let databaseName = '';
  let setupUrl = DATABASE_URL;
  if (createDatabaseIfMissing) {
    const parsed = new URL(DATABASE_URL);
    databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    if (!IDENTIFIER_RE.test(databaseName)) {
      console.error('CREATE_DATABASE_IF_MISSING requires a lowercase SQL identifier as the database name');
      process.exitCode = 1;
      return;
    }
    parsed.pathname = '/postgres';
    setupUrl = parsed.toString();
  }
  const setupPool = new Pool({ connectionString: setupUrl });
  let pool: Pool | null = null;

  try {
    const escapeSqlLiteral = (value: string) => value.replace(/'/g, "''");
    for (const [role, password] of [
      [migratorRole, APP_MIGRATOR_DB_PASSWORD],
      [runtimeRole, APP_RUNTIME_DB_PASSWORD],
    ] as const) {
      const { rows } = await setupPool.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role]);
      if (rows.length === 0) {
        await setupPool.query(`CREATE ROLE ${role} LOGIN PASSWORD '${escapeSqlLiteral(password)}'`);
        console.log(`Created role: ${role}`);
      } else {
        await setupPool.query(`ALTER ROLE ${role} PASSWORD '${escapeSqlLiteral(password)}'`);
        console.log(`Role already existed, password rotated: ${role}`);
      }
    }

    if (createDatabaseIfMissing) {
      const { rows } = await setupPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
      if (rows.length === 0) {
        await setupPool.query(`CREATE DATABASE ${databaseName} OWNER ${migratorRole}`);
        await setupPool.query(`REVOKE ALL ON DATABASE ${databaseName} FROM PUBLIC`);
        await setupPool.query(`GRANT CONNECT ON DATABASE ${databaseName} TO ${runtimeRole}`);
        console.log(`Created database: ${databaseName} (owner ${migratorRole}, PUBLIC access revoked)`);
      } else {
        console.log(`Database already exists: ${databaseName}`);
      }
    }

    pool = createDatabaseIfMissing ? new Pool({ connectionString: DATABASE_URL }) : setupPool;

    await pool.query(`ALTER SCHEMA public OWNER TO ${migratorRole}`);
    await pool.query(`GRANT USAGE ON SCHEMA public TO ${runtimeRole}`);

    await pool.query(`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
          EXECUTE format('ALTER TABLE public.%I OWNER TO ${migratorRole}', r.tablename);
        END LOOP;
        FOR r IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' LOOP
          EXECUTE format('ALTER SEQUENCE public.%I OWNER TO ${migratorRole}', r.sequencename);
        END LOOP;
        FOR r IN SELECT typname FROM pg_type WHERE typtype = 'e' AND typnamespace = 'public'::regnamespace LOOP
          EXECUTE format('ALTER TYPE public.%I OWNER TO ${migratorRole}', r.typname);
        END LOOP;
      END
      $$;
    `);

    await pool.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${runtimeRole}`);
    await pool.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${runtimeRole}`);

    await pool.query(
      `ALTER DEFAULT PRIVILEGES FOR ROLE ${migratorRole} IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${runtimeRole}`
    );
    await pool.query(
      `ALTER DEFAULT PRIVILEGES FOR ROLE ${migratorRole} IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${runtimeRole}`
    );

    await reconcileRuntimePrivileges(pool, runtimeRole);

    console.log(`Provisioning complete. ${migratorRole} owns the schema; ${runtimeRole} has DML only, no DDL.`);
    console.log(
      'Next: point MIGRATOR_DATABASE_URL at the migrator role and DATABASE_URL at the runtime role in .env, then run db:migrate.'
    );
  } catch (err) {
    console.error('Failed to provision DB roles:', err.message);
    process.exitCode = 1;
  } finally {
    if (pool && pool !== setupPool) await pool.end();
    await setupPool.end();
  }
}

provisionDbRoles();
