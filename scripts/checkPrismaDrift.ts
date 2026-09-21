import 'dotenv/config';
import { spawnSync } from 'child_process';

const PRISMA_INVISIBLE = {
  tables: ['schema_migrations'],
  indexes: [] as string[],
  constraints: [
    'fk_surveys_attendee_session',
    'fk_messages_reply_same_conversation',
    'fk_participants_last_read_same_conversation',
    'fk_participants_last_delivered_same_conversation',
  ],
};

const quoted = (names: string[]) => names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

function isAllowed(statement: string): boolean {
  const { tables, indexes, constraints } = PRISMA_INVISIBLE;
  const rules: RegExp[] = [];
  if (tables.length) rules.push(new RegExp(`^DROP TABLE "(${quoted(tables)})";?$`));
  if (indexes.length) rules.push(new RegExp(`^DROP INDEX "(${quoted(indexes)})";?$`));
  if (constraints.length) rules.push(new RegExp(`^ALTER TABLE "[^"]+" DROP CONSTRAINT "(${quoted(constraints)})";?$`));
  return rules.some((rule) => rule.test(statement));
}

function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Set DATABASE_URL to a migrated database.');
    process.exitCode = 2;
    return;
  }
  const result = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['prisma', 'migrate', 'diff', '--from-config-datasource', '--to-schema', 'prisma/schema.prisma', '--script'],
    { encoding: 'utf8', shell: process.platform === 'win32' }
  );
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    process.exitCode = 1;
    return;
  }

  const statements = result.stdout
    .split('\n')
    .filter((line) => !line.startsWith('--') && !line.startsWith('Loaded Prisma config'))
    .join('\n')
    .split(/;\s*(?:\n|$)/)
    .map((statement) => statement.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const drift = statements.filter((statement) => !isAllowed(statement));
  if (drift.length > 0) {
    console.error('prisma/schema.prisma has drifted from the migrated database schema:');
    for (const statement of drift) console.error(`  ${statement}`);
    console.error('Update prisma/schema.prisma (and run `npx prisma generate`), or list the object in PRISMA_INVISIBLE if Prisma cannot model it.');
    process.exitCode = 1;
    return;
  }
  console.log('No drift: prisma/schema.prisma matches the migrated database schema.');
}

main();
