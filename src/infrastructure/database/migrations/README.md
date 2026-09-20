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
| 0001 | baseline | The schema as it stood when versioned migrations were introduced. Idempotent, so existing databases adopt it with no change. The two legacy row backfills the old `schema.sql` re-ran on every start (`pending → accepted` assignments; calendar `end_date`) were intentionally **not** carried over: they were one-time cleanups for legacy rows that had already run everywhere, yet were re-executed on every start. (The app can no longer create a `pending` assignment — assignment is immediate — so in practice they were no-ops; a data-mutating statement should still never re-run implicitly.) |
| 0002 | preflight_hardening_checks | Read-only. Checks every existing row against the rules that 0003–0006 introduce and aborts with a report (counts and ids, no personal data) *before anything else is applied* if any row would violate one. Migrations never modify rows, so a failure means "review this data", not "data was changed". Also what `db:plan` shows you on any database before you promote. |
| 0003 | unique_indexes (.notx) | `users(lower(email))`; one survey per attendee; an email once per session (case-insensitive, blank/NULL allowed); a training once per start time and an instructor once per start time among non-cancelled sessions (exactly the rules the use cases already enforce); the `(id, session_id)` and `(id, conversation_id)` keys composite foreign keys need. |
| 0004 | foreign_key_indexes (.notx) | Indexes on 18 foreign-key columns that had none (partial `WHERE col IS NOT NULL` for nullable ones). Most important: `audit_log(actor_id)` — purging a user used to scan the whole audit log. `users.role_id` (5 rows) is deliberately not indexed. |
| 0005 | add_constraints_not_valid | `CHECK`s (non-blank names/titles, email shape, ISO-2 country, `duration >= 0` and a unit needs a duration, message shape, https push endpoints) and composite FKs (a survey's attendee belongs to the survey's session; a reply or read/delivered marker stays inside its conversation, `ON DELETE SET NULL (col)`), all `NOT VALID`. Deliberately tolerant of legacy rows: blank attendee/client emails, durations without a unit, and approved users without `approved_at` all remain valid. |
| 0006 | validate_constraints | Validates 0005's constraints in a separate transaction, so the scan never holds the stronger lock. |
