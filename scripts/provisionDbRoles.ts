import 'dotenv/config';
import { Pool } from 'pg';

async function provisionDbRoles() {
  const { DATABASE_URL, APP_RUNTIME_DB_PASSWORD, APP_MIGRATOR_DB_PASSWORD } = process.env;

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

  
  
  
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    
    
    
    
    
    
    const escapeSqlLiteral = (value: string) => value.replace(/'/g, "''");
    for (const [role, password] of [
      ['app_migrator', APP_MIGRATOR_DB_PASSWORD],
      ['app_runtime', APP_RUNTIME_DB_PASSWORD],
    ] as const) {
      const { rows } = await pool.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role]);
      if (rows.length === 0) {
        await pool.query(`CREATE ROLE ${role} LOGIN PASSWORD '${escapeSqlLiteral(password)}'`);
        console.log(`Created role: ${role}`);
      } else {
        await pool.query(`ALTER ROLE ${role} PASSWORD '${escapeSqlLiteral(password)}'`);
        console.log(`Role already existed, password rotated: ${role}`);
      }
    }

    
    
    
    await pool.query('ALTER SCHEMA public OWNER TO app_migrator');
    await pool.query('GRANT USAGE ON SCHEMA public TO app_runtime');

    
    
    
    
    
    
    
    
    
    
    
    
    await pool.query(`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
          EXECUTE format('ALTER TABLE public.%I OWNER TO app_migrator', r.tablename);
        END LOOP;
        FOR r IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' LOOP
          EXECUTE format('ALTER SEQUENCE public.%I OWNER TO app_migrator', r.sequencename);
        END LOOP;
      END
      $$;
    `);

    
    
    await pool.query('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime');
    await pool.query('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime');

    
    
    await pool.query(
      'ALTER DEFAULT PRIVILEGES FOR ROLE app_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime'
    );
    await pool.query(
      'ALTER DEFAULT PRIVILEGES FOR ROLE app_migrator IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_runtime'
    );

    console.log('Provisioning complete. app_migrator owns the schema; app_runtime has DML only, no DDL.');
    console.log(
      'Next: point MIGRATOR_DATABASE_URL at app_migrator and DATABASE_URL at app_runtime in .env, then run db:migrate.'
    );
  } catch (err) {
    console.error('Failed to provision DB roles:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

provisionDbRoles();
