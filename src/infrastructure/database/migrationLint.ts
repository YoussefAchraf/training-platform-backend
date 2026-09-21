import type { MigrationFile } from './migrationRunner';
import { codeOnly, scanSql, splitStatements } from './sqlScanner';

export interface LintIssue {
  file: string;
  rule: string;
  message: string;
}

export const BASELINE_EXEMPT_VERSIONS = new Set([1]);

const HARMLESS_DROPS = /^(CONSTRAINT|INDEX|DEFAULT|NOT\s+NULL|TRIGGER|POLICY|IDENTITY|EXPRESSION|IF\s+EXISTS)\b/i;
const TX_CONTROL = /^(BEGIN|COMMIT|ROLLBACK|START\s+TRANSACTION|END|SAVEPOINT|RELEASE)\b/i;
const PRIVILEGE_STATEMENT = /^(GRANT|REVOKE|CREATE\s+ROLE|ALTER\s+ROLE|DROP\s+ROLE|ALTER\s+DEFAULT\s+PRIVILEGES)\b/i;

function tableOf(statement: string): string | null {
  const match = /^ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?("?[\w.]+"?)/i.exec(statement);
  return match ? match[1].replace(/"/g, '').toLowerCase() : null;
}

function createdTables(sql: string): Set<string> {
  const tables = new Set<string>();
  const pattern = /\bCREATE\s+(?:UNLOGGED\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?("?[\w.]+"?)/gi;
  for (let m = pattern.exec(sql); m; m = pattern.exec(sql)) tables.add(m[1].replace(/"/g, '').toLowerCase());
  return tables;
}

function topLevelClauses(alterStatement: string): string[] {
  const clauses: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of alterStatement) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      clauses.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  clauses.push(current);
  return clauses;
}

const snippet = (statement: string) => statement.replace(/\s+/g, ' ').slice(0, 90);

export function lintMigration(file: MigrationFile): LintIssue[] {
  const issues: LintIssue[] = [];
  const add = (rule: string, message: string) => issues.push({ file: file.filename, rule, message });
  const exempt = BASELINE_EXEMPT_VERSIONS.has(file.version);

  for (const segment of scanSql(file.sql)) {
    if (segment.kind === 'string' && segment.text.includes('\n')) {
      add('multiline-string', 'String literals must not span lines (comment/whitespace normalization would alter them).');
    }
  }

  const statements = splitStatements(file.sql);
  const newTables = createdTables(codeOnly(file.sql));

  for (const statement of statements) {
    const definesRoutine = /^\s*CREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|PROCEDURE)\b/i.test(statement);
    const code = codeOnly(statement, { includeDollarBodies: !definesRoutine }).replace(/\s+/g, ' ').trim();
    if (!code) continue;

    if (TX_CONTROL.test(code)) {
      add('no-tx-control', `Do not use explicit transaction control (${snippet(code)}); the runner manages transactions.`);
    }
    if (exempt) continue;

    if (PRIVILEGE_STATEMENT.test(code)) {
      add('no-privileges', `Roles and grants are environment-specific and are reconciled by the runner, not migrations (${snippet(code)}).`);
    }

    if (!file.destructive) {
      if (/\bTRUNCATE\b/i.test(code)) add('destructive', `TRUNCATE requires a .destructive migration (${snippet(code)}).`);
      if (/(?:^|;|\bBEGIN\b|\bTHEN\b|\bELSE\b|\bLOOP\b)\s*(?:UPDATE|DELETE\s+FROM)\b/i.test(code)) {
        add('destructive', `UPDATE/DELETE modify existing rows and require a .destructive migration (${snippet(code)}).`);
      }
      for (const drop of code.matchAll(/\bDROP\s+(.{0,25})/gi)) {
        if (!HARMLESS_DROPS.test(drop[1])) add('destructive', `DROP requires a .destructive migration (${snippet(code)}).`);
      }
      if (/\bALTER\s+TABLE\b.*\bALTER\s+(?:COLUMN\s+)?\S+\s+(?:SET\s+DATA\s+)?TYPE\b/i.test(code)) {
        add('destructive', `Changing a column type requires a .destructive migration (${snippet(code)}).`);
      }
      if (/\bALTER\s+TABLE\b.*\bRENAME\b/i.test(code) || /\bALTER\s+TABLE\b.*\bDROP\s+COLUMN\b/i.test(code)) {
        add('destructive', `Rename/drop of columns breaks running code and requires a .destructive migration (${snippet(code)}).`);
      }
    }

    const table = tableOf(code);
    if (table && /^ALTER\s+TABLE\b/i.test(code)) {
      for (const clause of topLevelClauses(code)) {
        if (/\bADD\s+COLUMN\b/i.test(clause) && /\bNOT\s+NULL\b/i.test(clause) && !/\bDEFAULT\b/i.test(clause) && !newTables.has(table)) {
          add('not-null-needs-default', `ADD COLUMN ... NOT NULL needs a DEFAULT on an existing table (${snippet(clause)}).`);
        }
        if (/\bADD\s+CONSTRAINT\b/i.test(clause) && !newTables.has(table)) {
          if (/\b(CHECK|FOREIGN\s+KEY)\b/i.test(clause) && !/\bNOT\s+VALID\b/i.test(clause)) {
            add('constraint-not-valid', `ADD CONSTRAINT CHECK/FOREIGN KEY must be NOT VALID, then VALIDATE separately (${snippet(clause)}).`);
          }
          if (/\b(UNIQUE|PRIMARY\s+KEY)\b/i.test(clause) && !/\bUSING\s+INDEX\b/i.test(clause)) {
            add('unique-using-index', `Add UNIQUE/PRIMARY KEY via CREATE UNIQUE INDEX CONCURRENTLY + USING INDEX (${snippet(clause)}).`);
          }
        }
      }
    }

    const index = /^CREATE\s+(?:UNIQUE\s+)?INDEX\s+(CONCURRENTLY\s+)?(IF\s+NOT\s+EXISTS\s+)?\S+\s+ON\s+(?:ONLY\s+)?("?[\w.]+"?)/i.exec(code);
    if (index) {
      const target = index[3].replace(/"/g, '').toLowerCase();
      if (!index[1] && !newTables.has(target)) {
        add('index-concurrently', `CREATE INDEX on an existing table must use CONCURRENTLY in a .notx migration (${snippet(code)}).`);
      }
      if (index[1] && !index[2]) add('idempotent-index', `CREATE INDEX CONCURRENTLY must use IF NOT EXISTS (${snippet(code)}).`);
    }
    if (/^DROP\s+INDEX\s+CONCURRENTLY\b/i.test(code) && !/\bIF\s+EXISTS\b/i.test(code)) {
      add('idempotent-index', `DROP INDEX CONCURRENTLY must use IF EXISTS (${snippet(code)}).`);
    }
  }

  const usesConcurrently = /\bCONCURRENTLY\b/i.test(codeOnly(file.sql));
  if (usesConcurrently && !file.noTransaction) {
    add('concurrently-needs-notx', 'CONCURRENTLY cannot run inside a transaction; rename the file to *.notx.sql.');
  }
  if (file.noTransaction && !usesConcurrently) {
    add('notx-needs-reason', 'A .notx migration should only exist to run CONCURRENTLY statements; use a normal migration.');
  }
  return issues;
}

export function lintMigrations(files: MigrationFile[]): LintIssue[] {
  return files.flatMap(lintMigration);
}
