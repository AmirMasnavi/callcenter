# CLAUDE.md

## Project

Call Center Daily Report System (Elm-o-Sanat Aria) — a Persian/RTL full-stack web app for
recording, reviewing, and analyzing call center daily performance reports. Java 21 /
Spring Boot 4.1 REST API + React 19 / Vite SPA, backed by PostgreSQL with Flyway migrations.
Session-cookie auth (Spring Session JDBC), CSRF via `XSRF-TOKEN` cookie, RBAC over four roles.

Not in scope: telephony/dialer integration, real-time call events, multi-tenancy.

## Memory System

Read MEMORY.md at the start of every session. It holds architecture decisions, known issues,
and project context.

When I say "remember this," write it to MEMORY.md immediately.

**Where things go:** Test 1 — prescribes behavior → CLAUDE.md. Test 2 — describes a fact that
could change → MEMORY.md.

## Module Map

| Module / Folder | Purpose |
| :---- | :---- |
| `services/api/` | Spring Boot REST API (Maven, Java 21) |
| `services/api/src/main/java/.../report/` | Report lifecycle: draft → submit → approve, optimistic locking, revisions |
| `services/api/src/main/java/.../user/` | Users, roles, admin CRUD, avatars |
| `services/api/src/main/java/.../auth/` | Login, session, `LoginGuard` brute-force throttle |
| `services/api/src/main/java/.../dashboard/` | Aggregations + xlsx/csv export (Apache POI) |
| `services/api/src/main/java/.../config/` | `SecurityConfig` (CORS/CSRF/RBAC), `BootstrapConfig` (seed users) |
| `services/api/src/main/resources/db/migration/` | Flyway migrations — schema changes go here ONLY |
| `apps/web/src/pages/` | One page per role: Agent, Supervisor, Manager, Admin |
| `apps/web/src/lib/api.ts` | Fetch wrapper (CSRF handling) + Persian/Jalali formatters |
| `infrastructure/nginx/` | Reverse proxy config |
| `docs/` | Architecture, API, schema, deployment, developer guide |

## Roles & Access

`AGENT` (operator) → `SUPERVISOR` → `MANAGER` / `ADMIN`. Route prefixes enforce this in
`SecurityConfig`: `/api/v1/admin/**` = ADMIN, `/api/v1/supervisor/**` = SUPERVISOR+ADMIN,
`/api/v1/dashboard/**` and `/api/v1/exports/**` = MANAGER+ADMIN.

## Code Style

- Backend is Java with a **very dense one-statement-per-line style** in existing files.
  Do not propagate it in new code — write conventionally formatted Java. Do not mass-reformat
  existing files unless asked; it destroys blame history.
- User-facing error messages are **Persian strings**. Keep them Persian and keep them in the
  layer that already owns them (service throws, `ApiExceptionHandler` maps to HTTP status).
- Frontend is TypeScript + React function components, no CSS framework — plain CSS files.

## Rules

- Schema changes go through a **new Flyway migration** (`V<n>__name.sql`). Never edit an
  applied migration and never rely on Hibernate DDL — `ddl-auto` is `validate`.
- Before touching a file, check for a related test and run it.
- Run `mvn -o clean test` (not bare `mvn test`) — a stale IDE-compiled `target/` produces
  bogus "Unresolved compilation problems" failures.
- Never commit `.env`. `.env.example` is the tracked template; keep the two in sync.
- `CORS_ALLOWED_ORIGINS` must contain the origin the **browser** loads the app from, or every
  login returns 403. curl hides this because it sends no `Origin` header.
- Report validation runs on **submit**, not on draft save. Drafts are intentionally allowed to
  hold inconsistent numbers.

## Verifying a change actually works

```bash
docker compose up -d --build
```
App on http://localhost:8088. Demo users (when `DEMO_USERS_ENABLED=true`):
`operator` / `supervisor` / `manager`, password `Demo12345!`; admin from `.env`.
All seeded users have `mustChangePassword=true` on first login.

## References

| Resource | Read when... |
| :---- | :---- |
| `docs/architecture.md` | Understanding module boundaries and request flow |
| `docs/api.md` | Adding or changing an endpoint |
| `docs/database-schema.md` | Writing a migration |
| `docs/deployment-and-devops.md` | Changing compose, nginx, or env config |
| `docs/developer-guide.md` | Setting up locally / running tests |
