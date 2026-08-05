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

### 2026-08-05 — Multi-role, auth UX, admin powers, and an Apple-design pass

Four changes requested together, all shipped and verified against the running stack:

1. **Multi-role.** `app_users.role` → `user_roles` (V4). Existing rows backfilled; verified
   against the live database. Access checks now test the widest role first, so a
   SUPERVISOR+ADMIN gets admin breadth. Demo user `lead` exists to exercise this.
2. **Auth UX.** Password minimum 10 → 8. The blocking change-password wall is gone: people
   enter the app and see a dismissible prompt. Changing a *temporary* password no longer
   asks for the current one (the user's explicit request — they just typed it at login);
   voluntary changes still do.
3. **Admin powers.** See/act on all reports, void+restore, reopen approved, impersonate.
   Impersonation is a real session swap, confirmed by admin routes returning 403 while active.
4. **Design.** apple-design skill applied via `theme.css` + `lib/motion.ts`.

**Appearance defaults to light on purpose.** The first pass followed
`prefers-color-scheme` and the user pushed back — dark is hard to read for some people. It
is now an explicit light/dark/system choice in Profile. Do not revert to auto-following the OS.

Two defects were caught only by looking at real screenshots, not by the build: dark mode was
half-applied (the older sheets hardcode `white` and `#fafcff`, which the token layer doesn't
reach), and `display: contents` on the user-card button removed it from the accessibility
tree, leaving unnamed buttons. Both fixed. The lesson holds generally — a green build says
nothing about whether the UI is right.

### 2026-08-05 — Permissions layer, plus three UI defects found by looking

**Granular permissions (V6).** Roles were too coarse: the ask was "let admin give a user
*some* abilities, like adding users or taking Excel/CSV exports". Roles now supply defaults
and `user_permissions` stores only the exceptions (grant or revoke) per user. Every route is
authorized on `PERM_*` rather than a role. Verified end to end: an operator granted
`EXPORT_DATA` gets 200 on `/exports` while still 403 on `/dashboard` and `/admin/users`, and a
supervisor with `REVIEW_REPORTS` revoked keeps the role but loses the queue.

Revokes are applied after grants deliberately, and only real exceptions are persisted — a
"grant" of something the role already gives is dropped, so changing someone's roles later
doesn't resurrect a stale override with new meaning.

**Three defects, all invisible to the build:**

1. **The save button was unreachable.** `mask-image` on `.content` (my own scroll-edge
   effect) creates a stacking context, so the modal's `z-index: 100` could not escape it and
   the bottom nav painted on top. Modals now portal to `<body>` via `components/Sheet.tsx`,
   and the edge fade is an overlay rather than a mask. **A high z-index means nothing if an
   ancestor has a mask/filter/transform.**
2. **Dark text was unreadable.** ~25 base rules use `color: var(--navy)` (#123a63) on a dark
   background. Fixed by remapping `--navy`/`--blue` to light tints in dark mode, then
   explicitly restoring a saturated blue for the two rules that use `--navy` as a *background*
   (`.primary`, `.report-tabs button.active`) — otherwise the primary button turns pale.
3. **Sheet rows ballooned.** `.modal label { display:block; margin:16px 0 6px }` outranks a
   single class, so `.role-option`/`.permission-row` stacked instead of laying out as rows.

Motion pass also landed: hover lift (gated behind `@media (hover: hover)` so taps don't stick),
a travelling active-nav indicator, staggered list entrances, and a shimmer skeleton — all
neutralised under `prefers-reduced-motion`.

## Known Issues

- **`LoginGuard` is in-memory per instance** (`ConcurrentHashMap`). Brute-force throttling is
  bypassable behind more than one API replica, and resets on restart. Fine at current scale;
  move to Redis/DB before scaling out.
- **`LoginGuard` lockout returns HTTP 409**, because it throws `IllegalStateException`.
  Semantically should be 429.
- **`ReportService.snapshot()` hand-builds JSON via string concatenation** and escapes only
  `"` → `'`. Newlines and backslashes in `notes` will produce malformed JSON in the
  `report_revisions` old/new value columns. Should use Jackson.
- ~~`AdminController.apply()` does not validate `supervisorId`~~ — fixed 2026-08-05.
- ~~No self-lockout guard in admin user editing~~ — fixed 2026-08-05 (`guardLastAdmin`).
- **The older stylesheets (`styles.css`, `usability.css`, 1.8k lines) hardcode a light
  palette.** `theme.css` remaps them for dark mode selector-by-selector. Any new surface
  added to the old sheets needs a matching `[data-theme='dark']` rule or dark mode breaks
  in that one spot. Converting those sheets to tokens would remove the whole class of bug.
- **Avatar fetch is open to any authenticated user** (`GET /api/v1/users/{id}/avatar`), with
  no role or team scoping.
- **Test coverage is still thin** — 12 backend (3 report rules + 9 permission) and 2 frontend
  tests. Testcontainers is on the classpath but no integration test uses it. The permission
  *resolution* is covered; the route-level authorization is only verified by hand.
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
