# Database migrations

Numbered, immutable SQL files applied in order by
`node dist/infrastructure/database/migrate.js` (`npm run db:migrate` locally).
See the main README section *Migrations and the dev → prod workflow* for the
full workflow; this page is the quick reference for authors.

## File naming

`NNNN_snake_case_name[.notx][.destructive].sql`

- `NNNN` — four digits, sequential from `0001`, no gaps, no duplicates.
- `.notx` — run **outside** a transaction (required for `CREATE INDEX CONCURRENTLY`).
- `.destructive` — modifies or removes existing rows/structure; refused unless
  `ALLOW_DESTRUCTIVE_MIGRATIONS=true`.

Flags live in the filename, not in SQL comments, because the repository's
`stripcomments` git filter removes comments at commit time. Checksums are
computed over comment-stripped, whitespace-normalized SQL, so a commented
working copy and the committed copy always match.

## Rules (checked by `npm run db:lint`)

1. Never edit, rename or delete a merged migration. Add a new one.
2. Expand first, contract later: add new structure (nullable/defaulted), ship
   the code that uses it, and remove the old structure in a separate, reviewed
   `.destructive` migration.
3. No `UPDATE`, `DELETE`, `TRUNCATE`, `DROP TABLE/COLUMN/TYPE`, column type
   changes or renames outside a `.destructive` migration.
4. Existing tables: `CHECK`/`FOREIGN KEY` constraints must be `NOT VALID`
   (validate in a later statement or migration); `NOT NULL` columns need a
   `DEFAULT`; `UNIQUE` via `CREATE UNIQUE INDEX CONCURRENTLY` + `USING INDEX`;
   indexes via `CREATE INDEX CONCURRENTLY IF NOT EXISTS` in a `.notx` file.
5. No `BEGIN`/`COMMIT`, and no roles or `GRANT`/`REVOKE` — the runner manages
   transactions and reconciles runtime privileges per environment.
6. String literals must not span lines.

## Index

| Version | Name | Notes |
|---|---|---|
| 0001 | baseline | The schema as it stood when versioned migrations were introduced. Idempotent, so existing databases adopt it with no change. The two legacy row backfills the old `schema.sql` re-ran on every start (`pending → accepted` assignments; calendar `end_date`) were intentionally **not** carried over: they had already run everywhere, and re-running the first silently accepted every pending instructor assignment on each deploy. |
