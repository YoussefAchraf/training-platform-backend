import { renderErdMarkdown, renderHtml, renderJson, renderMermaid, renderReference } from '../../../src/infrastructure/database/schemaDocs';
import type { SchemaInfo, TableInfo } from '../../../src/infrastructure/database/schemaDocs';

const col = (name: string, type = 'integer', notNull = true) => ({ name, type, notNull, default: null, comment: null });

function table(overrides: Partial<TableInfo> & { name: string }): TableInfo {
  return {
    comment: `${overrides.name} description`,
    columns: [col('id')],
    primaryKey: ['id'],
    uniques: [],
    foreignKeys: [],
    checks: [],
    indexes: [],
    triggers: [],
    ...overrides,
  };
}

const schema: SchemaInfo = {
  tables: [
    table({ name: 'users', columns: [col('id'), col('email', 'character varying(150)')], uniques: [{ name: 'users_email_key', columns: ['email'] }] }),
    table({
      name: 'profiles',
      columns: [col('id'), col('user_id')],
      uniques: [{ name: 'profiles_user_id_key', columns: ['user_id'] }],
      foreignKeys: [{ name: 'profiles_user_fk', columns: ['user_id'], refTable: 'users', refColumns: ['id'], onDelete: 'CASCADE', onUpdate: 'NO ACTION', validated: true }],
    }),
    table({
      name: 'posts',
      columns: [col('id'), col('author_id', 'integer', false), col('created_at', 'timestamp with time zone')],
      foreignKeys: [{ name: 'posts_author_fk', columns: ['author_id'], refTable: 'users', refColumns: ['id'], onDelete: 'SET NULL', onUpdate: 'NO ACTION', validated: true }],
    }),
    table({
      name: 'post_tags',
      columns: [col('post_id'), col('tag_id')],
      primaryKey: ['post_id', 'tag_id'],
      foreignKeys: [
        { name: 'pt_post_fk', columns: ['post_id'], refTable: 'posts', refColumns: ['id'], onDelete: 'CASCADE', onUpdate: 'NO ACTION', validated: true },
        { name: 'pt_post_composite_fk', columns: ['post_id', 'tag_id'], refTable: 'posts', refColumns: ['id', 'tag_id'], onDelete: 'CASCADE', onUpdate: 'NO ACTION', validated: false },
      ],
    }),
  ],
  enums: [{ name: 'status', values: ['a', 'b'] }],
  functions: ['sync_it'],
  migrations: [{ version: 1, name: 'baseline', flags: [] }, { version: 2, name: 'index', flags: ['notx'] }],
};

describe('schema documentation renderers', () => {
  it('draws mandatory-parent identifying, optional-parent and one-to-one relationships with the right cardinality', () => {
    const erd = renderMermaid(schema);
    expect(erd.startsWith('erDiagram')).toBe(true);
    expect(erd).toContain('users ||..o| profiles : "user_id"');
    expect(erd).toContain('users o|..o{ posts : "author_id"');
    expect(erd).toContain('posts ||--o{ post_tags : "post_id"');
  });

  it('hides a composite foreign key that only reinforces a simpler one, but still lists it in the reference', () => {
    const erd = renderMermaid(schema);
    expect(erd).not.toContain('post_id, tag_id');
    expect(renderReference(schema)).toContain('pt_post_composite_fk');
    expect(renderReference(schema)).toContain('NOT VALID');
  });

  it('marks key columns and normalises types for Mermaid', () => {
    const erd = renderMermaid(schema);
    expect(erd).toContain('varchar(150) email UK');
    expect(erd).toContain('int user_id FK,UK');
    expect(erd).toContain('int post_id PK,FK');
  });

  it('restricts a domain diagram to its tables, showing referenced tables as stubs', () => {
    const erd = renderMermaid(schema, ['posts']);
    expect(erd).toContain('posts {');
    expect(erd).toContain('users {');
    expect(erd).not.toContain('profiles');
  });

  it('is deterministic and covers every table in every format', () => {
    for (const render of [renderReference, renderErdMarkdown, renderHtml, renderJson]) {
      expect(render(schema)).toBe(render(JSON.parse(JSON.stringify(schema))));
    }
    const reference = renderReference(schema);
    for (const t of schema.tables) expect(reference).toContain(`## ${t.name}`);
    expect(reference).toContain('| 0002 | index | notx |');
    expect(renderHtml(schema)).toContain('<pre class="mermaid">');
    expect(JSON.parse(renderJson(schema)).tables).toHaveLength(4);
  });

  it('escapes user-controlled text in the HTML page', () => {
    const hostile: SchemaInfo = { ...schema, tables: [table({ name: 'x', comment: '<script>alert(1)</script>' })] };
    expect(renderHtml(hostile)).not.toContain('<script>alert(1)</script>');
  });
});
