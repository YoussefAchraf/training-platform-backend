import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { loadMigrations } from '../src/infrastructure/database/migrationRunner';
import {
  introspectSchema,
  renderErdMarkdown,
  renderHtml,
  renderJson,
  renderReference,
} from '../src/infrastructure/database/schemaDocs';

const OUT_DIR = path.join(__dirname, '..', 'docs', 'database');
const MIGRATIONS_DIR = path.join(__dirname, '..', 'src', 'infrastructure', 'database', 'migrations');

const normalize = (text: string) => text.replace(/\r\n/g, '\n');

async function main() {
  const check = process.argv.includes('--check');
  const connectionString = process.env.DOCS_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Set DOCS_DATABASE_URL (or DATABASE_URL) to a fully migrated database.');
    process.exitCode = 2;
    return;
  }

  const migrations = loadMigrations(MIGRATIONS_DIR).map((m) => ({
    version: m.version,
    name: m.name,
    flags: [m.noTransaction ? 'notx' : '', m.destructive ? 'destructive' : ''].filter(Boolean),
  }));

  const pool = new Pool({ connectionString });
  try {
    const schema = await introspectSchema(pool, migrations);
    const files: Record<string, string> = {
      'SCHEMA-REFERENCE.md': renderReference(schema),
      'ERD.md': renderErdMarkdown(schema),
      'erd.html': renderHtml(schema),
      'schema.json': renderJson(schema),
    };

    if (check) {
      const stale = Object.entries(files)
        .filter(([name, content]) => {
          const file = path.join(OUT_DIR, name);
          return !fs.existsSync(file) || normalize(fs.readFileSync(file, 'utf8')) !== content;
        })
        .map(([name]) => name);
      if (stale.length > 0) {
        console.error(`Database docs are out of date: ${stale.join(', ')}. Run "npm run docs:db" against a migrated database and commit the result.`);
        process.exitCode = 1;
        return;
      }
      console.log('Database docs are up to date.');
      return;
    }

    fs.mkdirSync(OUT_DIR, { recursive: true });
    for (const [name, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(OUT_DIR, name), content);
    }
    console.log(`Wrote ${Object.keys(files).length} files to docs/database/ (${schema.tables.length} tables, ${schema.enums.length} enums).`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Docs generation failed:', err.message);
  process.exitCode = 1;
});
