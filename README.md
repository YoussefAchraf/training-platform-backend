# Training Platform — Backend

A REST API for running a corporate training operation end to end: a
catalog of providers and the trainings they offer, clients, scheduled
sessions, instructor assignment, attendee management (including bulk
import from a spreadsheet and attendance tracking), post-session surveys,
and the reports generated from them — plus push and email notifications
along the way. Built in Express and TypeScript, on Postgres (via Prisma)
and Redis, structured as Clean Architecture with the dependency rule
enforced by the linter rather than left as a convention people can forget.

This document is long on purpose — it's meant to answer "why is this
built this way" everywhere it's a fair question, not just list commands.

---

## Table of contents

1. [What this system does](#what-this-system-does)
2. [Quick start](#quick-start)
3. [Environment variables](#environment-variables)
4. [Architecture](#architecture)
5. [The domain model, and whether this is "real" DDD](#the-domain-model-and-whether-this-is-real-ddd)
6. [Testing strategy](#testing-strategy)
7. [The database](#the-database)
8. [Security model](#security-model)
9. [API reference](#api-reference)
10. [API documentation (Swagger / OpenAPI)](#api-documentation-swagger--openapi)
11. [Notifications](#notifications)
12. [Every file and script, and why it exists](#every-file-and-script-and-why-it-exists)
13. [Docker and running it in production](#docker-and-running-it-in-production)
14. [DevSecOps: from a `dev` push to a running deployment](#devsecops-from-a-dev-push-to-a-running-deployment)
15. [Who this repository is really asking you to be](#who-this-repository-is-really-asking-you-to-be)
16. [Clean Architecture as portability insurance: could this become a Quarkus service?](#clean-architecture-as-portability-insurance-could-this-become-a-quarkus-service)

---

## What this system does

Four roles use this platform, and the whole data model exists to serve
what each of them needs to do:

- **Sales** and **Manager** manage the catalog (training providers, the
  trainings each provider offers — with a duration expressed in either
  days or hours — and clients) and schedule sessions: booking a specific
  training, for a specific client, on specific dates. They add attendees
  one at a time or import a whole roster at once from a `.csv`/`.xlsx`
  file.
- A **Manager** additionally approves new signups (nobody can log in
  until a Manager approves their account — including, awkwardly, the
  very first Manager, which is why there's a seed script for that),
  assigns an Instructor to a session, edits any catalog record or
  session regardless of who created it, and sees the audit log (their
  own view excludes changes to *other users'* accounts).
- Assigning a session to an **Instructor** is immediate and final —
  a Manager picks a qualified, approved Instructor who isn't already
  booked at that exact start time, and the session moves straight to
  "assigned," with the Instructor notified by email and (if they've
  enabled it) a browser push notification. From there, the Instructor
  manages their own bio and the list of trainings they're qualified to
  deliver, marks attendees Present or Absent once a session runs, and —
  once it ends — generates a QR code linking to a public survey form for
  attendees to fill in.
- Attendee survey responses feed automatically into a **Report** for that
  session — generated on demand, or automatically once either every
  attendee has responded or a configurable amount of time has passed
  since the session ended.
- A **SuperAdmin** sees and can touch everything: every user regardless
  of role or status, a platform-wide sessions overview, and the complete
  unscoped audit log.

Nothing in this system is a frontend concern bleeding into the backend —
this is a pure API. Whatever consumes it (a web app, initially) is a
separate, unrelated codebase; the frontend does get one small piece of
UX state stored here, though — a per-account flag for whether someone has
already seen the guided product tour, so it doesn't relaunch on every
login.

## Quick start

```bash
npm install
cp .env.example .env               # fill in your real values - see below
npm run db:provision-roles          # one-time: creates the app_migrator/app_runtime DB roles
npm run db:migrate                  # applies src/infrastructure/database/schema.sql
npm run dev                         # nodemon + ts-node, restarts on save
```

The API listens on `PORT` (default `4000`). `GET /health` returns
`{ "status": "ok" }` once it's up.

Nobody can log in until a Manager exists and has approved them, and no
route can create the first Manager — every signup starts at
`status = 'pending'`. There are two ways around the chicken-and-egg
problem:

- **SuperAdmin** (recommended): `npm run db:seed-superadmin` reads
  `SUPERADMIN_*` from `.env` and creates one directly — the *only* way a
  SuperAdmin account can ever come into existence, deliberately, since
  there's no API route for it either. Safe to re-run.
- **Manager**, the manual way: sign up normally through `POST /auth/signup`,
  then hand-approve yourself with a raw SQL `UPDATE users SET status =
  'approved' WHERE email = '...'` (or promote via a SuperAdmin once one
  exists).

## Environment variables

Every value below is already documented with a comment in `.env.example`
— copy it to `.env` and fill in real values. This table is the same
information, gathered in one place:

| Variable | Required | What it's for |
|---|---|---|
| `PORT` | No (default `4000`) | Port the API listens on. |
| `CLIENT_URL` | Yes | Allowed CORS origin, and the base URL used to build links in emails (login, pending-approvals, session details). |
| `DATABASE_URL` | Yes | Postgres connection string the running app uses — the least-privilege `app_runtime` role (DML only, no DDL). |
| `MIGRATOR_DATABASE_URL` | Yes | Postgres connection string for `npm run db:migrate` only — the `app_migrator` role, which owns the schema and can run DDL. Never used by the running server. |
| `APP_RUNTIME_DB_PASSWORD` / `APP_MIGRATOR_DB_PASSWORD` | Yes | Read only by `npm run db:provision-roles` — the passwords baked into the two connection strings above. Must be at least 20 characters and different from each other. |
| `JWT_SECRET` | Yes | Signs and verifies short-lived access tokens. Must be a long, random, real secret in anything beyond local dev. |
| `JWT_EXPIRES_IN` | No (default `8h`) | Access token lifetime. |
| `REDIS_URL` | Yes | Backs refresh tokens and rate limiting. `docker-compose.yml` overrides this to point at its own `redis` service with auth. |
| `REDIS_PASSWORD` | Yes, for docker-compose | No default on purpose — required to start the `redis`/`backend` services. |
| `REFRESH_TOKEN_TTL_DAYS` | No (default `30`) | How long a refresh token stays valid, and how long it takes an idle session to require a real login again. |
| `TRUST_PROXY` | No (default `false`) | Set `true` behind a real reverse proxy/ingress so rate limiting sees the real client IP instead of the proxy's. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Yes | Used for every outbound email: signup notifications to managers, approval/rejection notices, instructor assignment notices, and manager notifications when a catalog record or session changes. |
| `REPORT_JOB_CRON` | No (default `*/10 * * * *`) | How often the auto-report cron job checks for ended sessions. |
| `REPORT_AUTO_GENERATE_AFTER_MINUTES` | No (default `60`) | How long after a session ends, with no report yet, before one gets generated automatically. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Yes, for push notifications | Generate a real pair with `npx web-push generate-vapid-keys`. The public key is also needed by the frontend; only the private key is a real secret. Without these set, push sends are simply skipped rather than failing anything. |
| `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` / `SUPERADMIN_FIRSTNAME` / `SUPERADMIN_LASTNAME` | Only for `db:seed-superadmin` | Never read by the running server itself — only by that one bootstrap script. |

## Architecture

```
src/
├── domain/            entities + repository interfaces - no framework, no DB, no HTTP
├── use-cases/          one class per business action - depends only on domain
├── infrastructure/      Prisma-backed repositories, bcrypt/JWT, email, PDF, QR code, push, file parsing, the cron job
├── interface/           Express controllers, routes, auth/role/rate-limit/sanitize/upload middleware
├── docs/                assembles the OpenAPI spec from what each route file documents about itself
├── generated/prisma/    the Prisma Client, generated from prisma/schema.prisma - never hand-edited
├── app.ts               composition root - wires every concrete class together by hand
└── server.ts             starts the HTTP server, starts the report cron job, owns graceful shutdown
```

The dependency rule: `interface` depends on `use-cases`, `use-cases`
depends on `domain`, `infrastructure` depends on `domain` (and on the
generated Prisma client, which only `infrastructure` is allowed to
import) — and `domain` depends on nothing at all. A repository is a
plain TypeScript **interface** (`IUserRepository`, `ISessionRepository`,
...) that lives in `domain`; the actual Prisma-backed implementation
(`PgUserRepository`, ...) lives in `infrastructure` and implements that
interface. A use case is constructed with whatever interfaces it needs
and never imports a concrete `Pg*Repository` directly — it doesn't know
Prisma or Postgres exist.

**Nothing is auto-wired.** There's no dependency-injection container, no
decorators, no reflection. `app.ts` — the composition root — is a single
function that constructs every concrete class in dependency order by
hand: repositories first, then the use cases that need them, then the
controllers that need those, then the Express routes that need the
controllers, and finally the Express app itself. It reads like a plain
list of `new X({ y, z })` calls because that's exactly what it is. This
is a deliberate choice, not a gap — it means "what does this use case
actually depend on" is answered by reading one constructor, never by
tracing a DI framework's runtime resolution.

### The dependency rule is a lint error, not a convention

`eslint.config.mjs` uses `eslint-plugin-boundaries` to turn the diagram
above into something the linter actually checks:

```js
policies: [
  { from: 'domain',         allow: ['domain'] },
  { from: 'use-cases',      allow: ['domain', 'use-cases'] },
  { from: 'infrastructure', allow: ['domain', 'infrastructure', 'generated'] },
  { from: 'interface',      allow: ['domain', 'use-cases', 'interface'] },
  { from: 'docs',           allow: ['docs', 'interface'] },
  { from: 'composition-root' /* app.ts, server.ts */, allow: ['everything'] },
]
```

A controller importing a concrete `PgUserRepository` directly instead of
going through a use case, or a domain entity reaching into
`infrastructure`, is a lint **error** — caught in CI on every push, not
something that quietly rots over eighteen months of feature work. This
is the single most important thing to understand about how this
codebase stays honest about its own architecture. `docs` is allowed to
import from `interface` and nothing else, for one specific reason (see
[API documentation](#api-documentation-swagger--openapi) below):
`swaggerDefinition.ts` collects each route file's own documentation
object, so it never turns into a place business logic could leak into.

`@typescript-eslint/no-explicit-any` is deliberately a **warning**, not
an error — this codebase types almost everything as `any` rather than
modeling every database row and request shape, so making it an error
today would fail on hundreds of pre-existing, intentional occurrences.
New code still gets nudged toward real types via the warning without
the whole build breaking over it.

## The domain model, and whether this is "real" DDD

There's a fair question buried in "is this DDD": Domain-Driven Design is
a big discipline (bounded contexts, aggregates, value objects, domain
events, a ubiquitous language shared with domain experts), and most
codebases that reference it only actually adopt a slice of it. Worth
being precise about which slice this one adopts, rather than either
overclaiming or dismissing it.

**What's genuinely here:**
- **Entities with real behavior, not anemic data bags.** `User` isn't
  just `{ id, email, role }` — it has `isApproved()`, `isManager()`,
  `canManageCatalog()`, `isSuperAdmin()`. Business rules like "only Sales
  or Manager can touch the catalog" are asked of the entity
  (`requester.canManageCatalog()`), not reimplemented as scattered
  `if (role === 'Sales' || role === 'Manager')` checks across every use
  case that needs the answer.
- **Repository interfaces owned by the domain, not by the database.**
  `IUserRepository` is domain vocabulary ("find a user by email"), and
  it's `domain` that dictates the interface — `infrastructure` conforms
  to it, not the other way around. This is the actual point of the
  Dependency Inversion half of DDD/Clean Architecture: swapping the data
  layer for something else would mean writing a new class that
  implements the same interface, not touching a single use case — which
  is exactly what happened once already in this codebase, when every
  repository moved from hand-written SQL to Prisma without a single
  use case changing.
- **A ubiquitous language that shows up consistently**: Provider,
  Training, Client, Session, Instructor, Survey, Report — the same nouns
  in the domain entities, the database table names, the route paths, and
  this README. Nobody has to mentally translate between "what the
  business calls it" and "what the code calls it."

**What's honestly not here**, so as not to overclaim: no formally modeled
aggregates or aggregate roots (a `TrainingSession` and its attendees are
related through repository calls, not enforced as one consistency
boundary); no value objects (an email is a validated string, not an
`Email` type that makes an invalid one unrepresentable); no domain
events; no CQRS. This is **pragmatic, lightweight DDD** — the parts that
pay for themselves in a system this size (rich entities, repository
interfaces living in the domain, a consistent vocabulary) without the
ceremony that a system this size doesn't need yet.

## Testing strategy

**287 tests, 48 suites**, split into three deliberately different kinds:

- `tests/unit/` — one file per use case (plus domain-level tests, e.g.
  `Survey.test.ts`, `isValidEmail.test.ts`, and infrastructure-level
  tests for pure logic like `AttendeeFileParserService.test.ts`), every
  repository and service passed in as a hand-rolled mock object. These
  run in milliseconds, need no database, and exist to pin down business
  *rules*: "only Sales or Manager can create a client," "a rejected
  account has every refresh token revoked," "a session already carrying
  a report or survey response can't be edited," "assigning an instructor
  who's already booked at that exact start time is rejected."
- `tests/integration/` — one file per Prisma repository, exercised
  against a real Postgres database rather than mocked. This is what
  actually proves a repository's queries do what the use-case tests
  assume they do — the join shapes, the soft-delete semantics, the
  scheduling-conflict lookups, the NPS-score aggregation math.
- `tests/smoke/app.test.ts` — the one test file that boots the real,
  fully-wired Express app (via `buildApp()`, the same composition root
  production uses) against real Postgres and Redis service containers
  in CI. This is what actually proves the wiring in `app.ts` is
  correct, not just that each use case and each repository is correct on
  its own — a codebase can have every other test passing and still be
  broken at the point everything gets connected together, and this is
  the test that would catch that.

**`npm run test:unit`** runs only the fast, dependency-free subset — the
one you'd run in a tight edit-test loop. **`npm test`** runs everything,
which is what CI runs, and needs the Postgres/Redis service containers
CI provides.

## The database

**Two layers, deliberately separate.** Schema *ownership* and *data
access* are not the same job here, and the tooling reflects that split:

- **Schema definition and migration**: a hand-written, idempotent
  `src/infrastructure/database/schema.sql` (`CREATE TABLE IF NOT
  EXISTS`, `ADD COLUMN IF NOT EXISTS` throughout), applied by
  `npm run db:migrate` — a small script that reads the file and runs it
  as one statement. Safe to run repeatedly against a database that
  already has some or all of the schema, which is exactly what makes it
  usable both for a fresh database and for rolling a schema change out
  to one that already exists.
- **Data access**: every repository (`PgUserRepository`,
  `PgSessionRepository`, ...) queries through **Prisma**, using a
  hand-written `prisma/schema.prisma` that mirrors `schema.sql` and a
  generated client at `src/generated/prisma/`. Prisma's own migration
  engine (`prisma migrate`) is deliberately not part of this picture —
  `schema.sql` stays the one place the schema is actually defined, and
  Prisma's role is strictly "type-safe queries against that schema,"
  not "own the schema."
- Where a query genuinely can't be expressed through Prisma's query
  builder without changing its behavior — the NPS-score aggregation
  formula, a multi-join session-overview query with correlated subquery
  counts — the repository uses Prisma's `$queryRaw` with a tagged
  template (parameterized safely, not string concatenation) rather than
  forcing an awkward approximation through the query builder.

**Least-privilege database roles.** The running application and the
schema migration never connect as the same database user:
`app_migrator` owns the schema and is the only role with DDL rights,
used exclusively by `npm run db:migrate`; `app_runtime` — what
`DATABASE_URL` actually points at for the running server — can only
`SELECT`/`INSERT`/`UPDATE`/`DELETE`. A credential leak from the running
app process can no longer mean "attacker can drop tables." Both roles
are created idempotently by `npm run db:provision-roles`
(`scripts/provisionDbRoles.ts`), which needs to run once against a
bootstrap superuser before anything else.

Tables: `roles`, `users`, `providers`, `trainings`, `clients`,
`instructors`, `instructor_skills`, `training_sessions`,
`session_attendees`, `calendar`, `surveys`, `reports`, `audit_log`,
`push_subscriptions`.

The shape mirrors the domain model directly — `training_sessions`
references a training, a client, and (once assigned) an instructor;
`calendar` holds one row per scheduled session with a start and end
time, generated automatically alongside session creation, not
maintained separately; `session_attendees` tracks both whether an
attendee has submitted their survey and, independently, whether the
instructor has marked them present or absent for the session itself;
`audit_log` records actor, action, entity type/id, and before/after
snapshots for every create/update/delete/approve/reject/cancel across
the system, which is what both the Manager-scoped and SuperAdmin-full
audit log endpoints actually query.

## Security model

- **Sessions live in httpOnly cookies, not a token your frontend code
  ever touches.** `POST /auth/login` (and `/auth/admin-login`) set three
  cookies: an httpOnly `accessToken` (short-lived JWT, `JWT_EXPIRES_IN`),
  an httpOnly `refreshToken` (scoped to `/auth`), and a JS-readable
  `csrfToken`. No token is ever returned in a response body for the
  browser flow. `authMiddleware` doesn't just trust the access token's
  signature and move on, either — it decodes the token, looks the user
  up fresh from the database, and checks `user.isApproved()` on **every
  single request**. A deactivated or rejected account's still-unexpired
  token stops working the moment that status change is written, not
  whenever the token would have expired anyway.
- **A separate bearer-token path exists for cross-origin, non-browser
  callers** (`GET /auth/service-token`) — an ordinary JWT, identical in
  shape and expiry to the cookie's, meant to be requested and used
  immediately by a service that can't rely on the browser's cookie jar
  (a server-to-server integration, for instance), never persisted
  client-side.
- **Refresh tokens are opaque, random, and live in Redis** — not JWTs at
  all, specifically because they *do* need to be genuinely revocable.
  Only the SHA-256 hash of the token is stored (`RefreshTokenStore`), so
  a Redis data leak doesn't hand out usable tokens directly. Every
  refresh token is tracked in a per-user Redis set, which is what makes
  "revoke all of this user's sessions" (on logout, on rejection, on
  deactivation) a real, complete operation rather than a best-effort
  guess. Refresh tokens rotate on every use — presenting one invalidates
  it and issues a new one — and `POST /auth/refresh` additionally
  requires a valid `X-CSRF-Token` header matching the `csrfToken`
  cookie, checked explicitly since this route runs before/without
  `authMiddleware` by design (an already-expired access token shouldn't
  block refreshing).
- **Every state-changing request needs that same CSRF header** — the
  double-submit pattern: the value in `X-CSRF-Token` must match the
  non-httpOnly `csrfToken` cookie, which only a same-origin page could
  ever have read and sent back.
- **Role checks are structural**, not scattered `if` statements copied
  between routes: `requireRole(['Manager'])` is Express middleware
  applied directly in the route definition (`adminRoutes.ts`,
  `sessionRoutes.ts`, etc.), so the allowed roles for an endpoint are
  visible by reading the route table, not by reading every controller
  method's body. **`SuperAdmin` bypasses every `requireRole` check
  globally** (`roleMiddleware.ts` checks `req.user.isSuperAdmin()` first,
  before checking the route's actual allowed-roles list) — a SuperAdmin
  passes any role gate in the system by design, not by being explicitly
  listed on every route.
- **Every request body is sanitized** (`sanitizeMiddleware`, right after
  `express.json()`): strings are trimmed and stripped of HTML/script
  content before any controller or use case ever sees them — except
  `password` and `refreshToken`, deliberately passed through untouched,
  since lossy sanitization of a credential would silently corrupt it
  rather than protect anything.
- **Uploaded attendee files are constrained on every axis that matters**:
  `uploadMiddleware` accepts only `.csv`/`.xlsx` by extension, caps the
  upload at 5MB, and keeps the file in memory rather than writing it to
  disk (the container has no persistent volume, and there's no reason
  for an uploaded roster to ever touch the filesystem). Parsing itself
  (`AttendeeFileParserService`) is best-effort per row — a bad row is
  skipped with a reason rather than failing the whole import.
- **Two independent Redis-backed rate limiters** — a loose one
  (`globalLimiter`, 300 requests / 5 min) applied to the whole app, a
  tighter one (`authLimiter`, 20 / 15 min) on signup/login/refresh, and
  a much stricter one still (`adminLoginLimiter`, 5 / 15 min)
  specifically on `/auth/admin-login`, where the blast radius of a
  successful brute force is highest. All three are Redis-backed rather
  than in-memory, so the limit holds across every running replica of the
  API, not reset per-instance.

## API reference

A session cookie (set by `/auth/login`, `/auth/admin-login`, or
refreshed via `/auth/refresh`) is required on every route below except
where marked **Public**. `GET /auth/service-token` issues a bearer
token for the separate cross-origin use case described above.

### Auth (`/auth`)
| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/auth/signup` | Public, rate-limited | body: firstname, lastname, email, password, role (Sales\|Manager\|Instructor). Always starts `status: pending`; notifies every approved Manager by email. |
| POST | `/auth/login` | Public, rate-limited | Sales/Manager/Instructor only — sets session cookies |
| POST | `/auth/admin-login` | Public, tightly rate-limited | SuperAdmin only — same cookies, much stricter rate limit |
| POST | `/auth/refresh` | Public, rate-limited | rotates the session using the httpOnly refresh cookie; requires the CSRF header |
| POST | `/auth/logout` | Any authenticated | revokes the current refresh token, clears session cookies |
| GET | `/auth/me` | Any authenticated (optional) | the currently authenticated user, or `{ user: null }` |
| PATCH | `/auth/me` | Any authenticated | update your own firstname/lastname, or mark the guided tour as seen (`hasSeenTour`) |
| GET | `/auth/service-token` | Any authenticated | mints a short-lived bearer token for cross-origin calls |
| GET | `/auth/roles` | Any authenticated | list of `{ id, name }` — resolves a `roleId` to a display name |
| GET | `/auth/users/pending` | Manager | the approval queue |
| POST | `/auth/users/:id/approve` | Manager | sends an approval email |
| POST | `/auth/users/:id/reject` | Manager | sends a rejection email, revokes every refresh token that user holds |

### Admin (`/admin`) — SuperAdmin only, except where noted
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/admin/users` | SuperAdmin | every user, any status — not filtered to `approved` like other listings |
| PATCH | `/admin/users/:id` | SuperAdmin | edit any user's profile, role, or status directly; refuses to change the role/status of the last remaining active SuperAdmin |
| DELETE | `/admin/users/:id` | SuperAdmin | deactivate a user; same last-SuperAdmin protection |
| GET | `/admin/sessions` | SuperAdmin | platform-wide sessions overview, with training/client/instructor/creator names and attendee counts already joined in |
| GET | `/admin/audit-log` | Manager (scoped) / SuperAdmin (full) | a Manager's view excludes changes to *other users'* accounts; SuperAdmin's doesn't; filterable by `entityType`/`entityId` |

### Providers (`/providers`) · Trainings (`/trainings`) · Clients (`/clients`)
| Method | Path | Access |
|---|---|---|
| GET | `/providers` · `/trainings?providerId=` · `/clients` | Any authenticated |
| POST | same paths | Sales, Manager |
| PATCH / DELETE | `/providers/:id` · `/trainings/:id` · `/clients/:id` | Sales or Manager **who created that record**, or SuperAdmin |

A training's `duration` is paired with a `durationUnit` (`days` or
`hours`), so "3" can mean three days or three hours depending on what's
actually being scheduled.

### Sessions (`/sessions`)
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/sessions` | Any authenticated | an Instructor sees only sessions assigned to them |
| POST | `/sessions` | Sales, Manager, SuperAdmin | also writes a matching global calendar entry; rejected if the same training already has another session starting at that exact time |
| PATCH | `/sessions/:id` | Sales/Manager (creator) or SuperAdmin | blocked once the session already has a survey response or report |
| POST | `/sessions/:id/cancel` | Sales/Manager (creator) or SuperAdmin | same protection, plus refuses to cancel an already-cancelled session |
| POST | `/sessions/:id/assign-instructor` | Manager | body: instructorId. Requires at least one attendee already added; the instructor must be approved and qualified for the training, and not already engaged in a different session at that exact start time. Assignment is immediate — notifies the instructor by email and push. |
| POST | `/sessions/:id/attendees` | Sales, Manager, SuperAdmin | body: name, email |
| GET | `/sessions/:id/attendees` | Any authenticated | Sales/Manager/SuperAdmin see any session's attendees; an Instructor only their own session's |
| POST | `/sessions/:id/attendees/import` | Sales, Manager, SuperAdmin | multipart upload, `.csv`/`.xlsx` with a `Name` column and optional `Email` column; imports best-effort, skipping (with a reason) rows with a missing name, an invalid or duplicate email, or an attendee already registered in a session that overlaps this one in time |
| PATCH | `/sessions/:id/attendees/:attendeeId` | Sales, Manager, SuperAdmin | body: name, email; edits an attendee's details. Frontend stops offering this once the session's attendance has started being marked, though it isn't backend-enforced |
| DELETE | `/sessions/:id/attendees/:attendeeId` | Sales, Manager, SuperAdmin | removes an attendee entirely; rejected if they've already submitted a survey |
| PATCH | `/sessions/:id/attendees/:attendeeId/attendance` | the session's assigned Instructor | body: status (present\|absent) |

### Instructors (`/instructors`)
| Method | Path | Access |
|---|---|---|
| GET | `/instructors` | Sales, Manager |
| GET | `/instructors/me` | Instructor |
| PATCH | `/instructors/me` | Instructor — body: bio, trainingIds[] |
| PATCH | `/instructors/:id` | Manager — edit any instructor's profile |

### Calendar (`/calendar`)
| Method | Path | Access |
|---|---|---|
| GET / PATCH / DELETE | `/calendar/global`, `/calendar/global/:id` | Sales, Manager |
| GET | `/calendar/mine` | Instructor — filtered to their own sessions |

Every calendar event carries both a start (`eventDate`) and an
`endDate`, generated automatically from a session's own dates and kept
in sync with them.

### Survey (`/survey`)
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/survey/:sessionId/qr-code` | Instructor | own session only, returns a QR image |
| GET | `/survey/:sessionId/form` | **Public** | what the QR code links to — no auth, since attendees aren't platform users |
| POST | `/survey/:sessionId/submit` | **Public** | attendee submission; rejects a second submission from the same attendee; auto-triggers report generation once every attendee has responded |

### Reports (`/reports`)
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/reports/:sessionId` | Sales, Manager, Instructor | |
| GET | `/reports/:sessionId/pdf` | Sales, Manager, Instructor | rebuilt on demand (`pdfkit`) from current data, not stored as a file — the container has no persistent volume, so anything written to disk wouldn't survive a restart |
| POST | `/reports/:sessionId/generate` | Sales, Manager | manual trigger; also happens automatically via the cron job described below |

Reports additionally auto-generate through `ReportSchedulerService`, a
`node-cron` job (`REPORT_JOB_CRON`, default every 10 minutes) that looks
for sessions ended more than `REPORT_AUTO_GENERATE_AFTER_MINUTES`
(default 60) ago with no report yet, and generates one.

### Push notifications (`/push`)
| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/push/subscribe` | Any authenticated | body: endpoint, keys (p256dh, auth) — a standard Web Push subscription object |
| POST | `/push/unsubscribe` | Any authenticated | body: endpoint |

## API documentation (Swagger / OpenAPI)

Interactive docs at `GET /api-docs` (Swagger UI); the raw spec at
`GET /api-docs.json`. The spec is assembled at startup from documentation
that lives **inside each route file**, right next to the routes it
describes, rather than in one giant hand-authored file or a separate
directory that can drift out of sync with the code — each route file
(`providerRoutes.ts`, `sessionRoutes.ts`, ...) exports a plain object
(`providerRoutesDocs`, `sessionRoutesDocs`, ...) alongside its route
registrations, and `src/docs/swaggerDefinition.ts` imports and merges
every one of them, then bolts on the shared `info`/`tags`/
`components.schemas`/security scheme. Adding a new endpoint means adding
to that same route file's own documentation object, in the same diff as
the route itself.

To export a static copy — for a frontend team, a Postman/Insomnia import,
or an OpenAPI codegen tool:

```bash
npm run docs:export
# writes docs/openapi.json and docs/openapi.yaml
```

## Notifications

Two independent channels, used together for the events that matter most:

- **Email** (`EmailService`, via SMTP/`nodemailer`): a new signup
  notifies every approved Manager; an approval or rejection notifies the
  applicant; an instructor being assigned to a session notifies that
  instructor; and Sales/Manager get notified by email whenever another
  Sales/Manager updates, deletes, or cancels a catalog record or session
  they didn't personally act on. Every one of these sends is
  best-effort — a failed send is logged and swallowed, never allowed to
  fail the request that triggered it.
- **Web Push** (`WebPushService`, standard VAPID-based Web Push): an
  instructor who has subscribed a browser (`POST /push/subscribe`) gets
  a push notification the moment they're assigned to a session, in
  addition to the email. An expired subscription is detected from the
  push service's own response and cleaned up automatically rather than
  left to fail silently on every future send.

## Every file and script, and why it exists

| File / directory | What it is | Why it's built this way |
|---|---|---|
| `src/domain/` | Entities (`User`, `TrainingSession`, ...) and repository interfaces (`I*Repository`). | Zero imports from anywhere else in the codebase — the one directory `eslint-plugin-boundaries` allows nothing but itself to be imported from here. This is what makes the domain layer genuinely framework-agnostic (see the Quarkus section below). |
| `src/use-cases/` | One class per business action, named for what it does (`CreateSessionUseCase`, `SubmitSurveyUseCase`, ...), constructed with the repository interfaces it needs. | The actual business logic lives here, not in controllers — a controller's job is translating HTTP into a use-case call and a use-case's result back into HTTP, nothing more. |
| `src/infrastructure/` | Concrete `Pg*Repository` classes (one per domain repository interface, all Prisma-backed), `PasswordHasher`/`TokenService`/`RefreshTokenStore` (security), `EmailService`/`QRCodeService`/`PdfReportService`/`WebPushService`/`AttendeeFileParserService`/`ReportSchedulerService`. | Everything that talks to the outside world (Postgres, Redis, SMTP, a push service, the filesystem, the clock) lives here, behind an interface the domain owns. |
| `src/interface/` | Express controllers, routes, and middleware (`authMiddleware`, `roleMiddleware`, `rateLimitMiddleware`, `sanitizeMiddleware`, `uploadMiddleware`). | The HTTP-facing edge — the only layer that knows Express exists. |
| `src/docs/` | `swaggerDefinition.ts`, which collects each route file's own exported documentation object. | Kept as its own boundary type in the lint config specifically so documentation assembly can't accidentally become a place business logic leaks into — it's allowed to import from `interface` and nothing else. |
| `src/generated/prisma/` | The generated Prisma Client, built from `prisma/schema.prisma`. | Never hand-edited — regenerated by `npx prisma generate`, which runs automatically as part of the Docker build and CI setup. Only `infrastructure` is allowed to import from it. |
| `src/app.ts` | The composition root — builds every concrete object and wires the Express app. | See [Architecture](#architecture) above. |
| `src/server.ts` | Starts the HTTP server, starts the report cron job, and owns graceful shutdown (`SIGTERM`/`SIGINT` close the HTTP server, then the Postgres pool, then the Redis connection, in that order, before exiting). | Kept separate from `app.ts` specifically so tests can import `buildApp()` and get a fully-wired Express app without ever opening a real port — that's exactly what `tests/smoke/app.test.ts` does. |
| `src/infrastructure/database/schema.sql` + `migrate.ts` | The entire schema as one idempotent (`IF NOT EXISTS`) SQL file, applied by a small script connecting as the `app_migrator` role. | No migration framework, because `schema.sql` is deliberately the single place the schema is defined — Prisma reads the same shape but never owns migrating it. One file, safe to re-run, is simpler than a stack of numbered up/down migrations for a schema at this stage of the project's life. |
| `prisma/schema.prisma` + `prisma.config.ts` | The Prisma schema mirroring `schema.sql`, and Prisma's own connection/config file. | What `npx prisma generate` reads to produce the typed client every repository queries through. |
| `scripts/provisionDbRoles.ts` | Idempotently creates the `app_migrator` and `app_runtime` Postgres roles and grants each exactly the privileges it needs. | Run once per database, before `db:migrate` ever points at it with the runtime role — see [The database](#the-database) above. |
| `scripts/seedSuperAdmin.ts` | The *only* way a SuperAdmin account can ever be created — reads `SUPERADMIN_*` from `.env`, refuses to run with a password under 12 characters, no-ops safely if that email already exists. | Deliberately out-of-band: there is no API route that can create a SuperAdmin, on purpose, so that capability can never be reached over HTTP by anyone, ever. |
| `scripts/exportSwagger.ts` | Writes the live OpenAPI spec to `docs/openapi.json`/`.yaml` on disk. | For consumers that want a static file rather than hitting `/api-docs.json` on a running server. |
| `scripts/setup-git-filters.js` + `scripts/strip-comments.js` + `.gitattributes` | A `prepare` script (runs automatically on `npm install`) that registers a git **clean filter**: every `.ts`/`.js`/`.yml`/`.sql`/`Dockerfile`/etc. has its comments stripped out at the moment it's staged/committed. | A genuinely distinctive, easy-to-miss repo convention worth knowing about explicitly: comments you write locally are real and stay in your working tree, but they never make it into a git commit. This is why some files in this repo have oddly empty-looking gaps where a comment clearly used to explain something — that's not a formatting accident, it's this filter doing exactly what it's configured to do. It's also why this repository's API documentation lives in exported TypeScript objects rather than JSDoc comments: a comment-based approach would have its content silently stripped by this exact filter the moment it's committed. |
| `ecosystem.config.js` | PM2 process config — one instance, fork mode, auto-restart, 300MB memory-restart threshold. | See the Docker section below for why PM2 specifically. |
| `tests/tsconfig.json` | A separate TypeScript config for `tests/`, extending the root one. | Lets test files use `@types/jest` and relax a couple of settings without affecting how `src/` itself compiles. |

## Docker and running it in production

```bash
docker compose up -d --build
```

`docker-compose.yml` runs five services: `postgres`, `redis` (password-
protected, append-only persistence), a one-shot `provision-roles`
service (idempotent, creates the two Postgres roles described above), a
one-shot `migrate` service gated behind it that applies `schema.sql` and
exits, and `backend` itself — gated behind `migrate` completing
successfully, so the API never starts against an unmigrated database.

The `Dockerfile` is a four-stage multi-stage build: `deps` (installs
with native build tools available, since `bcrypt` needs to compile),
`build` (runs `npx prisma generate`, then compiles TypeScript),
`prod-deps` (a *separate* clean install with `--omit=dev`, so
devDependencies never end up in the final image), and `runtime` — a
minimal `node:26-alpine` image, upgraded to the latest Alpine security
patches at build time, that only ever sees the compiled `dist/` output
and production `node_modules`, running as the non-root `node` user, with
`npm`/`npx`/`corepack` deliberately removed from the final image (a
compiled Node app has no reason to have a package manager available
inside its own runtime container — one less thing an attacker who gets a
shell can use).

The container's actual process is run through **PM2**
(`pm2-runtime ecosystem.config.js`), not a bare `node dist/server.js`.
PM2's `max_memory_restart` gives an automatic recovery path for a slow
memory leak without needing an external orchestrator to notice and
intervene, and it's what makes a future move to multiple instances
(`instances: 'max'`, cluster mode) a one-line config change rather than
a rewrite — even though this config currently runs exactly one instance
in fork mode, matching where the project actually is today.

There's a `HEALTHCHECK` baked into the image itself (`GET /health`),
independent of whatever orchestrator eventually runs this container —
Docker, Kubernetes, or anything else can all observe the same signal.

## DevSecOps: from a `dev` push to a running deployment

The branch model, end to end:

```
feature/**  --push-->  auto-opens a PR into dev  --checks pass-->  auto-merges
dev  --workflow_dispatch "Promote dev to main"-->  opens a PR into main (no auto-merge)
main  --merge-->  full verify + build + Trivy scan + push to GHCR --> gitops repo auto-updated
```

`feature/**` → `dev` is fully automated and gated on CI — nobody has to
remember to open that PR or click merge, but nothing merges with a red
check either. `dev` → `main` is manually triggered and **deliberately
does not auto-merge**, even though everything else in this pipeline
does — promoting to `main` is exactly the point where a human should
look at what's actually going out before it becomes a published image.

**`verify.yml`** (reused via `workflow_call` on every feature push, every
PR, and every main merge) runs six jobs in parallel:
- **lint** / **typecheck** — `eslint .` and `tsc --noEmit`
- **sca** — `npm audit` + `npm outdated`, informational for now, not yet
  a hard gate
- **sast** — Semgrep, `auto` ruleset, via a Docker-run container, also
  informational for now
- **secret-scan** — Gitleaks, **blocking**: a real secret in a diff
  fails the build
- **test** — the full suite (`npm test`) against real Postgres and Redis
  service containers spun up inside the CI job itself, not mocks — the
  same smoke test described above runs here, against infrastructure as
  close to production as CI reasonably gets

**`docker-build-and-scan.yml`** builds the actual production image, then
runs a **Trivy** vulnerability scan against it — `severity: CRITICAL,HIGH`
with `exit-code: 1`, meaning this one genuinely blocks the pipeline,
unlike the SCA/SAST jobs above. Only on a `main` merge does it also log
in to GHCR and push — tagged by short commit SHA, `latest`, and semver
if applicable. A pull request build never pushes anything anywhere; it
only proves the image *would* build and pass its scan. On a real push to
GHCR, the same workflow goes one step further: it checks out the
companion `training-platform-gitops` repository, bumps the backend
image tag there, and opens a PR against that repo's own `dev` branch —
which auto-merges once its own checks pass, the same way this repo's
feature branches do. The image build and the deployment manifest update
are two different repositories, but the pipeline treats them as one
continuous chain, not two separately-triggered processes someone has to
remember to keep in sync.

CodeQL runs alongside as a separate, GitHub-native static analysis pass.
Dependabot watches three ecosystems weekly (`npm`, `docker`,
`github-actions`) and opens its own PRs, which flow through the exact
same `feature`-equivalent checks as anything a person pushes.
`.github/CODEOWNERS` requires review on everything. Together, this is a
real, if evolving, DevSecOps posture — SAST, SCA, secret scanning, and
container scanning are all present in the pipeline; the two that aren't
hard-blocking yet (SCA, SAST) are a deliberate, visible next step rather
than a silent gap.

## Who this repository is really asking you to be

Worth answering directly, since the shape of this repo genuinely raises
the question: is working on this a **backend engineer** job, or a
**platform engineer** job?

The honest answer is **both, and the repo is built in a way that doesn't
let you cleanly separate them.** A backend engineer's normal day here —
add a use case, wire it into `app.ts`, add a route (with its own
documentation object right beside it), write the unit test — is exactly
what you'd expect. But that same engineer is also expected to
understand: why the linter itself enforces the architecture and what
breaks if a boundary is violated; how a feature branch's push actually
becomes a running container, including a deployment-manifest update in a
separate repository; what SAST, SCA, and a Trivy scan are each
independently catching and why none of them is redundant with the
others; why `main` specifically needs a human in the loop when nothing
else in the pipeline does; and why the production container runs through
PM2 instead of a bare `node` process.

That's not incidental. It's a consequence of a small team (or a solo
maintainer, going by the commit history) owning the *entire* path from
"business rule" to "container running somewhere," rather than handing
the last half of that off to a separate platform/infra team the way a
larger organization might split it. If you're evaluating whether this
role fits you: it fits someone who wants to own outcomes, not just
write correct TypeScript — the CI pipeline, the Docker image, and the
branch protection rules are as much a part of "the system" here as any
use case is, and treated with the same level of intentionality
throughout this codebase.

## Clean Architecture as portability insurance: could this become a Quarkus service?

This is the kind of question Clean Architecture is specifically supposed
to make answerable, so it's worth actually answering rather than waving
at in the abstract.

**What would port over almost unchanged, conceptually:** the entire
`domain/` layer. `User`, `TrainingSession`, and the rest have zero
framework dependencies today — no Express types, no Prisma types,
nothing Node-specific beyond plain JavaScript classes. Translated to
Java, these become plain POJOs or records with the same methods
(`isApproved()`, `canManageCatalog()`); the repository interfaces
(`IUserRepository` etc.) become Java interfaces with the same method
signatures. `use-cases/` maps onto Quarkus `@ApplicationScoped` service
beans almost mechanically — the business logic inside each one doesn't
reference Express, Prisma, or Redis directly today (it goes through
injected interfaces), so there's genuinely very little to rewrite beyond
syntax.

**What changes meaningfully, and where the real work would be:**
- **Dependency injection** goes from this repo's explicit, hand-written
  composition root (`app.ts`) to Quarkus's CDI container resolving
  `@Inject` points automatically. This is a net simplification of
  *wiring*, but it's also the loss of the one thing this repo's approach
  buys you today: "what does this class depend on" being answerable by
  reading its constructor, not by trusting a container to have figured
  it out at runtime.
- **`interface/`** (Express controllers/routes) gets replaced by JAX-RS
  resources (`@Path`, `@GET`, `@POST` annotations) — a real rewrite, but
  a mechanical one, since the routing table in this README is already
  effectively the spec for it.
- **`infrastructure/`** repositories would move from Prisma to Quarkus's
  Panache/Hibernate — more of a rewrite than a port, since the query
  style is genuinely different, but the *interface* each repository has
  to satisfy doesn't change at all, which is exactly the point of the
  domain owning that interface in the first place. Having already gone
  through one real data-layer swap (hand-written SQL → Prisma) without
  touching a single use case is direct, lived proof this boundary holds
  up under an actual migration, not just in theory.
- Node-specific infrastructure needs real Java equivalents: `node-cron`
  → Quarkus's built-in `@Scheduled`; `ioredis` → the Quarkus Redis
  client; `pdfkit`/`qrcode` → a JVM PDF/QR library; `jsonwebtoken`/
  `bcrypt` → SmallRye JWT and a JVM bcrypt implementation; `web-push` →
  a JVM Web Push library implementing the same VAPID protocol.

The realistic verdict: this codebase couldn't be mechanically translated
file-for-file, but the **architecture's shape** — which is the part that
actually costs time to get right — transfers close to entirely. The
domain and use-case layers, which encode every actual business rule this
platform has, would need syntax changes and essentially zero logic
changes. That's the whole promise of keeping business logic isolated
from any specific framework, and it holds up here under a genuine "what
would it take" test, not just in theory.
