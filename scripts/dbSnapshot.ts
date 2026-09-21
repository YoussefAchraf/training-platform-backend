import 'dotenv/config';
import fs from 'fs';
import { Pool } from 'pg';

interface TableSnapshot {
  columns: string[];
  rows: number;
  hash: string | null;
}

type Snapshot = Record<string, TableSnapshot>;

const IGNORED_TABLES = new Set(['schema_migrations']);
const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;

async function listColumns(pool: Pool): Promise<Record<string, string[]>> {
  const { rows } = await pool.query(
    `SELECT c.table_name, c.column_name
       FROM information_schema.columns c
       JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
      WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      ORDER BY c.table_name, c.ordinal_position`
  );
  const byTable: Record<string, string[]> = {};
  for (const row of rows) {
    if (IGNORED_TABLES.has(row.table_name)) continue;
    (byTable[row.table_name] ||= []).push(row.column_name);
  }
  return byTable;
}

async function hashTable(pool: Pool, table: string, columns: string[]): Promise<TableSnapshot> {
  const cols = columns.map(ident).join(', ');
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n, md5(coalesce(string_agg(x, E'\\n' ORDER BY x), '')) AS h
       FROM (SELECT row(${cols})::text AS x FROM public.${ident(table)}) s`
  );
  return { columns, rows: rows[0].n, hash: rows[0].n === 0 ? null : rows[0].h };
}

async function capture(pool: Pool): Promise<Snapshot> {
  const snapshot: Snapshot = {};
  for (const [table, columns] of Object.entries(await listColumns(pool))) {
    snapshot[table] = await hashTable(pool, table, columns);
  }
  return snapshot;
}

async function compare(pool: Pool, baseline: Snapshot): Promise<string[]> {
  const problems: string[] = [];
  const current = await listColumns(pool);
  for (const [table, before] of Object.entries(baseline)) {
    const columns = current[table];
    if (!columns) {
      problems.push(`table ${table} no longer exists`);
      continue;
    }
    const missing = before.columns.filter((col) => !columns.includes(col));
    if (missing.length > 0) {
      problems.push(`table ${table}: column(s) removed: ${missing.join(', ')}`);
      continue;
    }
    const after = await hashTable(pool, table, before.columns);
    if (after.rows !== before.rows) problems.push(`table ${table}: row count ${before.rows} -> ${after.rows}`);
    else if (after.hash !== before.hash) problems.push(`table ${table}: row contents changed`);
  }
  return problems;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const file = rest[rest.indexOf('--file') + 1];
  const connectionString = process.env.SNAPSHOT_DATABASE_URL || process.env.DATABASE_URL;
  if (!['capture', 'compare'].includes(command) || rest.indexOf('--file') === -1 || !file) {
    console.error('Usage: dbSnapshot <capture|compare> --file <snapshot.json>   (env: SNAPSHOT_DATABASE_URL | DATABASE_URL)');
    process.exitCode = 2;
    return;
  }
  if (!connectionString) {
    console.error('Set SNAPSHOT_DATABASE_URL (or DATABASE_URL).');
    process.exitCode = 2;
    return;
  }

  const pool = new Pool({ connectionString });
  try {
    if (command === 'capture') {
      const snapshot = await capture(pool);
      fs.writeFileSync(file, JSON.stringify(snapshot, null, 2));
      const tables = Object.keys(snapshot).length;
      const rows = Object.values(snapshot).reduce((sum, t) => sum + t.rows, 0);
      console.log(`Captured ${tables} tables, ${rows} rows -> ${file}`);
      return;
    }
    const baseline: Snapshot = JSON.parse(fs.readFileSync(file, 'utf8'));
    const problems = await compare(pool, baseline);
    if (problems.length > 0) {
      console.error('EXISTING DATA CHANGED:');
      for (const problem of problems) console.error(`  - ${problem}`);
      process.exitCode = 1;
      return;
    }
    const rows = Object.values(baseline).reduce((sum, t) => sum + t.rows, 0);
    console.log(`OK: ${Object.keys(baseline).length} tables / ${rows} rows are byte-for-byte unchanged.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Snapshot failed:', err.message);
  process.exitCode = 1;
});
