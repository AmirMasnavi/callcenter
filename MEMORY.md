# MEMORY.md

*Last updated: 2026-08-05*

## Architecture Decisions

- **Optimistic locking over pessimistic.** `DailyReport` carries `@Version private long version`.
  Every mutating endpoint requires the client to send the version it read; a mismatch throws
  `IllegalStateException` → HTTP 409. This is why the SPA re-reads a report after every write.
- **Validation deferred to submit.** `ReportService.validate()` runs on submit and on review,
  but not on draft save. Rationale: operators fill reports incrementally through the day.
  Consequence: a persisted draft can hold nonsense (verified: a draft with
  `contactedCount > totalPeople` saves fine and reports `notContacted: -1`); submit then
  rejects it with 400.
- **Revisions are only recorded after first submission.** Editing a `DRAFT` writes no
  `report_revisions` row; editing a `SUBMITTED` or already-approved report does, and a
  correction reason is mandatory at that point.
- **Session cookies, not JWT.** Spring Session JDBC keeps sessions in Postgres so the API can
  scale horizontally without sticky sessions. Note `LoginGuard` does NOT share this property —
  see Known Issues.
- **Seed users via `BootstrapConfig`.** Admin always created; demo users only when
  `DEMO_USERS_ENABLED=true`. All seeded accounts get `mustChangePassword=true`.

## Known Issues

- **`LoginGuard` is in-memory per instance** (`ConcurrentHashMap`). Brute-force throttling is
  bypassable behind more than one API replica, and resets on restart. Fine at current scale;
  move to Redis/DB before scaling out.
- **`LoginGuard` lockout returns HTTP 409**, because it throws `IllegalStateException`.
  Semantically should be 429.
- **`ReportService.snapshot()` hand-builds JSON via string concatenation** and escapes only
  `"` → `'`. Newlines and backslashes in `notes` will produce malformed JSON in the
  `report_revisions` old/new value columns. Should use Jackson.
- **`AdminController.apply()` does not validate that `supervisorId` refers to a SUPERVISOR.**
  An AGENT can be assigned another AGENT as supervisor, which silently breaks the
  team-scoping check in `ReportService.assertCanReview()`.
- **No self-lockout guard in admin user editing.** An admin can deactivate or demote
  themselves / the last remaining admin.
- **Avatar fetch is open to any authenticated user** (`GET /api/v1/users/{id}/avatar`), with
  no role or team scoping.
- **Test coverage is thin** — 3 backend tests and 2 frontend tests against 27 Java files.
  Testcontainers is on the classpath but no integration test uses it.
- **`ManagerPage` bundle is ~1.15 MB** (ECharts, not code-split). Vite warns on every build.

## Changelog Notes

### 2026-08-05 — CORS default made the shipped stack unusable
`CORS_ALLOWED_ORIGINS` defaulted to `http://localhost:5173` (the Vite dev port) while
`docker-compose.yml` serves the SPA on `APP_PORT` (8088). A fresh `docker compose up` produced
an app where **every browser login returned 403 "Invalid CORS request."** It went unnoticed
because curl sends no `Origin` header and therefore succeeds.

Fixed in three places, all of which must stay in sync: the compose default (now
`http://localhost:${APP_PORT:-8088},http://localhost:5173`), `.env.example`, and the local
untracked `.env`. Verified by logging in through a real browser.

### 2026-08-05 — Stale `target/` breaks `mvn test`
`mvn -o test` failed with "Unresolved compilation problems" in `ReportRulesTest` while
`mvn test-compile` reported no errors. Cause: IDE (ECJ) compiled classes left in `target/`.
`mvn -o clean test` passes. Always use `clean`.

### 2026-08-05 — Stopped tracking `.idea/`
Four IntelliJ files were committed. Removed from the index and `.idea/` added to `.gitignore`.

## Verified Working (2026-08-05)

Full stack ran under Docker (db + api + web all healthy) and the core lifecycle was exercised
end to end: operator login → save draft → submit → supervisor approve → status `APPROVED`
with reviewer stamped. RBAC confirmed (operator gets 403 on supervisor routes). Dashboard,
filters, admin users, xlsx export, and OpenAPI all returned 200. Frontend builds and its
tests pass; backend compiles, packages, and its tests pass on a clean build.

## Contacts

*Who owns what. Add entries over time.*

- Repo git author: Amir (`a.masnavi1382@gmail.com`)
