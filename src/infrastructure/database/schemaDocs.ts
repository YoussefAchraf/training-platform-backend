import type { Pool } from 'pg';

export interface ColumnInfo {
  name: string;
  type: string;
  notNull: boolean;
  default: string | null;
  comment: string | null;
}

export interface ForeignKeyInfo {
  name: string;
  columns: string[];
  refTable: string;
  refColumns: string[];
  onDelete: string;
  onUpdate: string;
  validated: boolean;
}

export interface UniqueInfo {
  name: string;
  columns: string[];
}

export interface CheckInfo {
  name: string;
  definition: string;
  validated: boolean;
}

export interface IndexInfo {
  name: string;
  definition: string;
  unique: boolean;
  partial: boolean;
}

export interface TriggerInfo {
  name: string;
  definition: string;
}

export interface TableInfo {
  name: string;
  comment: string | null;
  columns: ColumnInfo[];
  primaryKey: string[];
  uniques: UniqueInfo[];
  foreignKeys: ForeignKeyInfo[];
  checks: CheckInfo[];
  indexes: IndexInfo[];
  triggers: TriggerInfo[];
}

export interface EnumInfo {
  name: string;
  values: string[];
}

export interface MigrationInfo {
  version: number;
  name: string;
  flags: string[];
}

export interface SchemaInfo {
  tables: TableInfo[];
  enums: EnumInfo[];
  functions: string[];
  migrations: MigrationInfo[];
}

const ACTIONS: Record<string, string> = { a: 'NO ACTION', r: 'RESTRICT', c: 'CASCADE', n: 'SET NULL', d: 'SET DEFAULT' };
const IGNORED_TABLES = new Set(['schema_migrations']);

export const DOMAIN_GROUPS: Array<{ id: string; title: string; tables: string[] }> = [
  {
    id: 'identity',
    title: 'Identity, notifications and audit',
    tables: [
      'roles',
      'users',
      'audit_log',
      'push_subscriptions',
      'feedback_reports',
      'feature_announcements',
      'feature_announcement_target_roles',
      'feature_announcement_ratings',
    ],
  },
  { id: 'catalog', title: 'Catalog: providers, trainings, clients, instructors', tables: ['providers', 'trainings', 'clients', 'instructors', 'instructor_skills'] },
  {
    id: 'delivery',
    title: 'Delivery: sessions, attendees, surveys, reports',
    tables: ['training_sessions', 'session_attendees', 'session_notes', 'calendar', 'surveys', 'reports'],
  },
  { id: 'messaging', title: 'Messaging', tables: ['conversations', 'conversation_participants', 'messages', 'message_deletions'] },
];

const sortBy = <T>(items: T[], key: (item: T) => string) => [...items].sort((a, b) => key(a).localeCompare(key(b)));

export async function introspectSchema(pool: Pool, migrations: MigrationInfo[]): Promise<SchemaInfo> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const ns = `'public'::regnamespace`;

    const tableRows = (
      await client.query(
        `SELECT c.oid::int AS oid, c.relname AS name, obj_description(c.oid, 'pg_class') AS comment
           FROM pg_class c WHERE c.relnamespace = ${ns} AND c.relkind = 'r' ORDER BY c.relname`
      )
    ).rows.filter((row) => !IGNORED_TABLES.has(row.name));
    const oids = tableRows.map((row) => row.oid);
    const nameByOid = new Map<number, string>(tableRows.map((row) => [row.oid, row.name]));

    const columnRows = (
      await client.query(
        `SELECT a.attrelid::int AS table_oid, a.attnum, a.attname AS name, format_type(a.atttypid, a.atttypmod) AS type,
                a.attnotnull AS not_null, pg_get_expr(d.adbin, d.adrelid) AS default_expr, col_description(a.attrelid, a.attnum) AS comment
           FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
          WHERE a.attnum > 0 AND NOT a.attisdropped AND a.attrelid = ANY($1::oid[])`,
        [oids]
      )
    ).rows;

    const constraintRows = (
      await client.query(
        `SELECT c.conrelid::int AS table_oid, c.conname AS name, c.contype, c.convalidated,
                pg_get_constraintdef(c.oid) AS definition, c.confrelid::int AS ref_oid, c.confdeltype, c.confupdtype,
                (SELECT array_agg(a.attname::text ORDER BY k.ord) FROM unnest(c.conkey) WITH ORDINALITY k(attnum, ord)
                   JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) AS columns,
                (SELECT array_agg(a.attname::text ORDER BY k.ord) FROM unnest(c.confkey) WITH ORDINALITY k(attnum, ord)
                   JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.attnum) AS ref_columns,
                (SELECT array_agg(a.attname::text ORDER BY a.attnum) FROM unnest(c.confdelsetcols) k(attnum)
                   JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) AS del_set_cols
           FROM pg_constraint c WHERE c.conrelid = ANY($1::oid[]) AND c.contype IN ('p', 'u', 'f', 'c')`,
        [oids]
      )
    ).rows;

    const indexRows = (
      await client.query(
        `SELECT i.indrelid::int AS table_oid, ic.relname AS name, pg_get_indexdef(i.indexrelid) AS definition,
                i.indisunique AS is_unique, (i.indpred IS NOT NULL) AS is_partial
           FROM pg_index i JOIN pg_class ic ON ic.oid = i.indexrelid WHERE i.indrelid = ANY($1::oid[])`,
        [oids]
      )
    ).rows;

    const triggerRows = (
      await client.query(
        `SELECT t.tgrelid::int AS table_oid, t.tgname AS name, pg_get_triggerdef(t.oid) AS definition
           FROM pg_trigger t WHERE t.tgrelid = ANY($1::oid[]) AND NOT t.tgisinternal`,
        [oids]
      )
    ).rows;

    const enumRows = (
      await client.query(
        `SELECT t.typname AS name, array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS values
           FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid WHERE t.typnamespace = ${ns} GROUP BY t.typname ORDER BY t.typname`
      )
    ).rows;

    const functionRows = (
      await client.query(`SELECT p.proname AS name FROM pg_proc p WHERE p.pronamespace = ${ns} ORDER BY p.proname`)
    ).rows;

    const tables: TableInfo[] = tableRows.map((table) => {
      const constraints = constraintRows.filter((row) => row.table_oid === table.oid);
      const primaryKey: string[] = constraints.find((row) => row.contype === 'p')?.columns ?? [];
      const columns: ColumnInfo[] = columnRows
        .filter((row) => row.table_oid === table.oid)
        .map((row) => ({
          name: row.name,
          type: row.type,
          notNull: row.not_null,
          default: row.default_expr,
          comment: row.comment,
        }));
      const orderedColumns = [
        ...primaryKey.map((name) => columns.find((column) => column.name === name)).filter(Boolean),
        ...sortBy(
          columns.filter((column) => !primaryKey.includes(column.name)),
          (column) => column.name
        ),
      ] as ColumnInfo[];

      return {
        name: table.name,
        comment: table.comment,
        columns: orderedColumns,
        primaryKey,
        uniques: sortBy(
          constraints.filter((row) => row.contype === 'u').map((row) => ({ name: row.name, columns: row.columns })),
          (u) => u.name
        ),
        foreignKeys: sortBy(
          constraints
            .filter((row) => row.contype === 'f')
            .map((row) => {
              const delAction = ACTIONS[row.confdeltype] ?? row.confdeltype;
              return {
                name: row.name,
                columns: row.columns,
                refTable: nameByOid.get(row.ref_oid) ?? String(row.ref_oid),
                refColumns: row.ref_columns,
                onDelete: row.del_set_cols ? `${delAction} (${row.del_set_cols.join(', ')})` : delAction,
                onUpdate: ACTIONS[row.confupdtype] ?? row.confupdtype,
                validated: row.convalidated,
              };
            }),
          (fk) => fk.name
        ),
        checks: sortBy(
          constraints
            .filter((row) => row.contype === 'c')
            .map((row) => ({ name: row.name, definition: row.definition, validated: row.convalidated })),
          (check) => check.name
        ),
        indexes: sortBy(
          indexRows
            .filter((row) => row.table_oid === table.oid)
            .map((row) => ({ name: row.name, definition: row.definition, unique: row.is_unique, partial: row.is_partial })),
          (index) => index.name
        ),
        triggers: sortBy(
          triggerRows.filter((row) => row.table_oid === table.oid).map((row) => ({ name: row.name, definition: row.definition })),
          (trigger) => trigger.name
        ),
      };
    });

    return {
      tables,
      enums: enumRows.map((row) => ({ name: row.name, values: row.values })),
      functions: functionRows.map((row) => row.name),
      migrations,
    };
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    client.release();
  }
}

const mermaidType = (type: string) => {
  const t = type
    .replace('timestamp with time zone', 'timestamptz')
    .replace('character varying', 'varchar')
    .replace('integer', 'int')
    .replace('boolean', 'bool')
    .replace(/\(\d+,\s*\d+\)/, '')
    .replace(/\s+/g, '_');
  return t;
};

function isUniqueSet(table: TableInfo, columns: string[]): boolean {
  const key = [...columns].sort().join(',');
  if ([...table.primaryKey].sort().join(',') === key) return true;
  return table.uniques.some((u) => [...u.columns].sort().join(',') === key);
}

function visibleForeignKeys(table: TableInfo): ForeignKeyInfo[] {
  return table.foreignKeys.filter(
    (fk) =>
      !table.foreignKeys.some(
        (other) =>
          other !== fk &&
          other.refTable === fk.refTable &&
          other.columns.length < fk.columns.length &&
          other.columns.every((column) => fk.columns.includes(column))
      )
  );
}

export function renderMermaid(schema: SchemaInfo, only?: string[]): string {
  const wanted = only ? new Set(only) : new Set(schema.tables.map((t) => t.name));
  const byName = new Map(schema.tables.map((t) => [t.name, t]));
  const relations: string[] = [];
  const included = new Set<string>(wanted);

  for (const table of schema.tables) {
    for (const fk of visibleForeignKeys(table)) {
      if (!wanted.has(table.name) && !wanted.has(fk.refTable)) continue;
      included.add(table.name);
      included.add(fk.refTable);
      const parent = byName.get(fk.refTable);
      const fkNotNull = fk.columns.every((c) => table.columns.find((col) => col.name === c)?.notNull);
      const identifying = fk.columns.every((c) => table.primaryKey.includes(c));
      const left = fkNotNull ? '||' : 'o|';
      const right = isUniqueSet(table, fk.columns) ? 'o|' : 'o{';
      relations.push(`  ${fk.refTable} ${left}${identifying ? '--' : '..'}${right} ${table.name} : "${fk.columns.join(', ')}"`);
      void parent;
    }
  }

  const entities: string[] = [];
  for (const name of [...included].sort()) {
    const table = byName.get(name);
    if (!table) continue;
    const fkColumns = new Set(table.foreignKeys.flatMap((fk) => fk.columns));
    const uniqueColumns = new Set(table.uniques.flatMap((u) => (u.columns.length === 1 ? u.columns : [])));
    const keyColumns = table.columns.filter((c) => table.primaryKey.includes(c.name) || fkColumns.has(c.name) || uniqueColumns.has(c.name));
    const shown = wanted.has(name) ? keyColumns : keyColumns.filter((c) => table.primaryKey.includes(c.name));
    const lines = shown.map((c) => {
      const tags = [table.primaryKey.includes(c.name) ? 'PK' : '', fkColumns.has(c.name) ? 'FK' : '', uniqueColumns.has(c.name) ? 'UK' : '']
        .filter(Boolean)
        .join(',');
      return `    ${mermaidType(c.type)} ${c.name}${tags ? ` ${tags}` : ''}`;
    });
    entities.push(`  ${name} {${lines.length ? '\n' + lines.join('\n') + '\n  ' : ''}}`);
  }

  return ['erDiagram', ...entities, ...relations.sort()].join('\n');
}

export function renderErdMarkdown(schema: SchemaInfo): string {
  const known = new Set(DOMAIN_GROUPS.flatMap((g) => g.tables));
  const others = schema.tables.map((t) => t.name).filter((name) => !known.has(name));
  const groups = others.length > 0 ? [...DOMAIN_GROUPS, { id: 'other', title: 'Other tables', tables: others }] : DOMAIN_GROUPS;
  const out: string[] = [
    '# Entity-relationship diagrams',
    '',
    '> Generated by `npm run docs:db` from a migrated database. Do not edit by hand.',
    '> Crow\'s-foot notation: `||` exactly one, `o|` zero or one, `o{` zero or many. A solid line is an identifying',
    '> relationship (the foreign key is part of the child\'s primary key); a dotted line is a plain reference.',
    '> Only key columns are drawn; see [SCHEMA-REFERENCE.md](SCHEMA-REFERENCE.md) for every column.',
    '',
    '## Whole schema',
    '',
    '```mermaid',
    renderMermaid(schema),
    '```',
  ];
  for (const group of groups) {
    out.push('', `## ${group.title}`, '', '```mermaid', renderMermaid(schema, group.tables), '```');
  }
  return out.join('\n') + '\n';
}

const cell = (value: string | null | undefined) =>
  (value ?? '').replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

export function renderReference(schema: SchemaInfo): string {
  const incoming = new Map<string, Array<{ table: string; fk: ForeignKeyInfo }>>();
  for (const table of schema.tables) {
    for (const fk of table.foreignKeys) {
      const list = incoming.get(fk.refTable) ?? [];
      list.push({ table: table.name, fk });
      incoming.set(fk.refTable, list);
    }
  }

  const out: string[] = [
    '# Database schema reference',
    '',
    '> Generated by `npm run docs:db` from a migrated PostgreSQL database; descriptions come from `COMMENT ON` statements',
    '> in the migrations, so they are also visible in pgAdmin. Do not edit by hand.',
    '',
    `${schema.tables.length} tables, ${schema.enums.length} enum types, ${schema.migrations.length} migrations.`,
    '',
    '## Tables',
    '',
    '| Table | Purpose | Columns | Refers to | Referenced by |',
    '|---|---|---|---|---|',
  ];
  for (const table of schema.tables) {
    const refersTo = [...new Set(table.foreignKeys.map((fk) => fk.refTable))].join(', ') || '-';
    const referencedBy = [...new Set((incoming.get(table.name) ?? []).map((i) => i.table))].join(', ') || '-';
    out.push(`| [${table.name}](#${table.name}) | ${cell(table.comment)} | ${table.columns.length} | ${refersTo} | ${referencedBy} |`);
  }

  for (const table of schema.tables) {
    out.push('', `## ${table.name}`, '', table.comment ?? '', '', '| Column | Type | Null | Default | Description |', '|---|---|---|---|---|');
    for (const column of table.columns) {
      const key = table.primaryKey.includes(column.name) ? ' (PK)' : '';
      out.push(`| ${column.name}${key} | ${column.type} | ${column.notNull ? 'NOT NULL' : 'null'} | ${cell(column.default) || ''} | ${cell(column.comment)} |`);
    }
    if (table.primaryKey.length) out.push('', `**Primary key:** ${table.primaryKey.join(', ')}`);
    if (table.uniques.length) out.push('', '**Unique constraints:**', ...table.uniques.map((u) => `- \`${u.name}\` (${u.columns.join(', ')})`));
    if (table.foreignKeys.length) {
      out.push(
        '',
        '**Foreign keys:**',
        ...table.foreignKeys.map(
          (fk) =>
            `- \`${fk.name}\`: (${fk.columns.join(', ')}) -> ${fk.refTable} (${fk.refColumns.join(', ')}), on delete ${fk.onDelete.toLowerCase()}${fk.validated ? '' : ', NOT VALID'}`
        )
      );
    }
    const referencing = incoming.get(table.name) ?? [];
    if (referencing.length) {
      out.push('', '**Referenced by:**', ...referencing.map((i) => `- ${i.table}(${i.fk.columns.join(', ')})`));
    }
    if (table.checks.length) {
      out.push('', '**Check constraints:**', ...table.checks.map((c) => `- \`${c.name}\`: \`${cell(c.definition)}\`${c.validated ? '' : ' (NOT VALID)'}`));
    }
    if (table.indexes.length) {
      out.push('', '**Indexes:**', ...table.indexes.map((i) => `- \`${i.name}\`${i.unique ? ' (unique)' : ''}${i.partial ? ' (partial)' : ''}: \`${cell(i.definition)}\``));
    }
    if (table.triggers.length) {
      out.push('', '**Triggers:**', ...table.triggers.map((t) => `- \`${t.name}\`: \`${cell(t.definition)}\``));
    }
  }

  out.push('', '## Enum types', '', '| Type | Values |', '|---|---|', ...schema.enums.map((e) => `| ${e.name} | ${e.values.join(', ')} |`));
  if (schema.functions.length) out.push('', '## Functions', '', ...schema.functions.map((f) => `- \`${f}\``));
  out.push(
    '',
    '## Migration history',
    '',
    '| Version | Name | Flags |',
    '|---|---|---|',
    ...schema.migrations.map((m) => `| ${String(m.version).padStart(4, '0')} | ${m.name} | ${m.flags.join(', ') || '-'} |`)
  );
  return out.join('\n') + '\n';
}

export function renderJson(schema: SchemaInfo): string {
  return JSON.stringify(schema, null, 2) + '\n';
}

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function renderHtml(schema: SchemaInfo): string {
  const known = new Set(DOMAIN_GROUPS.flatMap((g) => g.tables));
  const others = schema.tables.map((t) => t.name).filter((name) => !known.has(name));
  const groups = others.length > 0 ? [...DOMAIN_GROUPS, { id: 'other', title: 'Other tables', tables: others }] : DOMAIN_GROUPS;
  const diagrams = [{ id: 'all', title: 'Whole schema', source: renderMermaid(schema) }, ...groups.map((g) => ({ id: g.id, title: g.title, source: renderMermaid(schema, g.tables) }))];
  const cards = schema.tables
    .map(
      (table) => `<details class="card" data-name="${table.name}"><summary><b>${table.name}</b> <span>${escapeHtml(table.comment ?? '')}</span></summary>
<table><tr><th>Column</th><th>Type</th><th>Null</th><th>Description</th></tr>${table.columns
        .map(
          (c) =>
            `<tr><td>${c.name}${table.primaryKey.includes(c.name) ? ' <i>PK</i>' : ''}</td><td>${escapeHtml(c.type)}</td><td>${c.notNull ? 'NOT NULL' : 'null'}</td><td>${escapeHtml(c.comment ?? '')}</td></tr>`
        )
        .join('')}</table>
${table.foreignKeys.length ? `<p><b>References:</b> ${table.foreignKeys.map((fk) => `${fk.columns.join(', ')} &rarr; ${fk.refTable} <small>(on delete ${fk.onDelete.toLowerCase()})</small>`).join(' &middot; ')}</p>` : ''}
</details>`
    )
    .join('\n');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Training Platform database schema</title>
<style>
:root{--bg:#f6f7f9;--fg:#1c2430;--card:#fff;--line:#d9dee6;--accent:#0b6bcb}
@media (prefers-color-scheme:dark){:root{--bg:#12161c;--fg:#e6e9ee;--card:#1b212a;--line:#2c3542;--accent:#6cb4ff}}
body{margin:0;font:14px/1.5 system-ui,sans-serif;background:var(--bg);color:var(--fg)}
header{padding:16px 24px;border-bottom:1px solid var(--line);background:var(--card)}
h1{margin:0;font-size:20px}header p{margin:4px 0 0;opacity:.75}
main{padding:16px 24px;max-width:1600px;margin:auto}
nav{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}
nav button{border:1px solid var(--line);background:var(--card);color:var(--fg);padding:6px 12px;border-radius:6px;cursor:pointer}
nav button.active{background:var(--accent);color:#fff;border-color:var(--accent)}
.stage{background:var(--card);border:1px solid var(--line);border-radius:8px;overflow:auto;padding:12px;min-height:300px}
.zoom{margin:0 0 8px}.zoom button{padding:2px 10px}
.diagram{position:absolute;visibility:hidden;height:0;overflow:hidden}.diagram.active{position:static;visibility:visible;height:auto;overflow:visible}
.diagram .inner{transform-origin:top left}
input[type=search]{width:100%;max-width:420px;padding:8px;margin:16px 0 8px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--fg)}
.card{background:var(--card);border:1px solid var(--line);border-radius:8px;margin:6px 0;padding:8px 12px}
.card summary{cursor:pointer}.card summary span{opacity:.7;margin-left:8px}
table{border-collapse:collapse;width:100%;margin:8px 0}th,td{border:1px solid var(--line);padding:4px 8px;text-align:left;vertical-align:top}
small{opacity:.7}
</style></head><body>
<header><h1>Training Platform database schema</h1>
<p>${schema.tables.length} tables &middot; ${schema.enums.length} enum types &middot; ${schema.migrations.length} migrations &middot; generated from a migrated database (<code>npm run docs:db</code>)</p></header>
<main>
<nav id="tabs">${diagrams.map((d, i) => `<button data-id="${d.id}" class="${i === 0 ? 'active' : ''}">${escapeHtml(d.title)}</button>`).join('')}</nav>
<div class="zoom"><button id="zin">+</button> <button id="zout">&minus;</button> <button id="zreset">reset</button></div>
<div class="stage">${diagrams
    .map((d, i) => `<div class="diagram ${i === 0 ? 'active' : ''}" id="d-${d.id}"><div class="inner"><pre class="mermaid">${escapeHtml(d.source)}</pre></div></div>`)
    .join('')}</div>
<input type="search" id="filter" placeholder="Filter tables and columns...">
<div id="cards">${cards}</div>
</main>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<script>
var userZoom=1;
function activeDiagram(){return document.querySelector(".diagram.active")}
function fitFactor(){var d=activeDiagram();var svg=d&&d.querySelector("svg");if(!svg)return 1;
  var w=parseFloat(svg.getAttribute("width"))||(svg.viewBox&&svg.viewBox.baseVal&&svg.viewBox.baseVal.width)||svg.getBoundingClientRect().width;
  var stage=document.querySelector(".stage");var avail=stage.clientWidth-28;return w>0?Math.min(1,avail/w):1}
function apply(){var f=fitFactor()*userZoom;document.querySelectorAll(".diagram .inner").forEach(function(e){e.style.zoom=f})}
document.getElementById("zin").onclick=function(){userZoom=Math.min(4,userZoom*1.25);apply()};
document.getElementById("zout").onclick=function(){userZoom=Math.max(0.25,userZoom/1.25);apply()};
document.getElementById("zreset").onclick=function(){userZoom=1;apply()};
window.addEventListener("resize",apply);
document.querySelectorAll("#tabs button").forEach(function(b){b.onclick=function(){
  document.querySelectorAll("#tabs button").forEach(function(x){x.classList.remove("active")});b.classList.add("active");
  document.querySelectorAll(".diagram").forEach(function(d){d.classList.remove("active")});
  document.getElementById("d-"+b.dataset.id).classList.add("active");userZoom=1;apply();}});
document.getElementById("filter").oninput=function(e){var q=e.target.value.toLowerCase();
  document.querySelectorAll(".card").forEach(function(c){c.style.display=c.textContent.toLowerCase().indexOf(q)>=0?"":"none"})};
if(window.mermaid){mermaid.initialize({startOnLoad:false,theme:"neutral",er:{useMaxWidth:false}});
  mermaid.run({querySelector:".mermaid"}).then(apply);}
else{document.querySelector(".stage").insertAdjacentHTML("afterbegin","<p>The diagram library could not be loaded (offline?). Open ERD.md on GitHub, or use the pgAdmin ERD tool.</p>");}
</script></body></html>
`;
}
