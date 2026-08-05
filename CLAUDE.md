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

## Roles & Permissions

Two layers, and the distinction matters:

- **Roles** (`user_roles`) say what *kind* of user someone is. A user holds a SET of them.
- **Permissions** (`Permission` enum) say what they may *do*. Roles carry defaults
  (`Permission.defaultsFor`); `user_permissions` stores only the **exceptions** per user —
  `granted = true` adds a capability, `granted = false` withholds one the role would give.

Effective = role defaults + grants − revokes (`AppUser.effectivePermissions`). Revokes are
applied last so an admin can always take something back.

**Authorize on permissions, not roles.** `SecurityConfig` gates every route on
`hasAuthority("PERM_…")`, and service checks use `principal.can(Permission.X)`. That is what
lets an operator be granted `EXPORT_DATA` without being promoted to manager. `AppPrincipal`
publishes both `ROLE_*` and `PERM_*` authorities, so role checks still work where genuinely
about identity rather than capability.

When scoping data, **check the widest permission first** — `VIEW_ALL_REPORTS` before the
team-scoped `REVIEW_REPORTS`, or a supervisor-and-admin gets the narrower access
(see `assertCanReview`).

Adding a permission: add to the enum (with a Persian label), map it in `Permission.defaultsFor`,
gate the route in `SecurityConfig`, and mirror the enum + label in `lib/api.ts` and
`ROLE_DEFAULTS` in `AdminPage.tsx`.

## Frontend conventions

- Nav and controls key off **permissions** (`can()` / `canAny()` in `lib/api.ts`), not roles.
  `NAV` in `App.tsx` declares what each destination `needs`.
- **Modals must render through `components/Sheet.tsx`** (a portal to `<body>`). Any ancestor
  with a mask, filter or transform creates a stacking context that traps a nested modal
  regardless of z-index — that is exactly how the save button ended up under the bottom nav.
  For the same reason, don't put `mask-image` on `.content`.
- `.modal label` in the base sheet is `display:block` with margins and **outranks a single
  class**. New label-based controls inside a sheet need `.modal .your-class` specificity or
  they silently stack and balloon in height.
- The old sheets hardcode light colours (`white`, `#fafcff`, `#102a45`, `--red-light`…), so
  **every new surface needs a matching `[data-theme='dark']` rule**. To find what's missing,
  load the page in dark mode and scan computed styles for light backgrounds / low-contrast
  text rather than eyeballing it — that is how `.equation`, `.day-report-bar` and
  `.validation-list` were caught.
- Watch for classes that combine: `.report-tabs button.new` is declared after `.active` and
  overrode its `color`, giving blue-on-navy. Check the cascade when two state classes meet.
- **Appearance defaults to light and never silently follows the OS.** Dark is an explicit
  choice in Profile (`lib/theme.ts` sets `data-theme`; `theme.css` keys the dark palette off it).
  Do not reintroduce a bare `@media (prefers-color-scheme: dark)` — it takes the choice away.
- `theme.css` loads **last** and carries the apple-design layer (materials, motion,
  typography, a11y preferences). The older sheets hardcode a light palette, so any new
  surface added there needs a matching `[data-theme='dark']` rule or it breaks dark mode.
- Persian digits everywhere user-facing — use `fa()`, never a raw number in Persian copy.
- Settings-style screens use **grouped rows you step into** (`.more-list` + a sub-view with
  a back control), not every control stacked on one page. The row shows its current value
  so you can read the setting without opening it.
- **Form controls must be at least 16px on mobile.** Below that, iOS Safari force-zooms the
  page on focus and never zooms back — this is what made the app feel permanently zoomed.
- **RTL: `inset-inline-start` is the RIGHT edge.** Absolutely-positioned actions collide with
  right-aligned content (avatars) if you assume LTR. Check both sides when positioning.
- The bottom bar carries **four destinations, chosen per persona** (`PRIORITY_BY_PERSONA` in
  `App.tsx`) plus «بیشتر». An admin never files reports — do not rank destinations globally.
- Prefer an **icon + tooltip + aria-label** over a text button in list rows; a full-width text
  button on every row dominates the list and wraps on a phone.
- The base sheet positions queue rows with **`div:nth-child(2)`**. Inserting an element at
  the start of a `.queue button` silently retargets it (the avatar stretched into an
  ellipse). Append new children LAST and reposition with `order`.
- `.review-layout` is a two-column grid — anything added as a direct child consumes a cell
  and displaces the panels. Put toolbars outside it.
- **900px is the single mobile breakpoint** (where the sidebar swaps for the bottom bar).
  Exactly one navigation is visible at a time — never both.
- The sidebar was originally a **dark navy gradient**; its children still carry colours meant
  for dark. Anything added there needs a token-based override, and `usability.css` had
  `!important` rules from that era — check for them before assuming a rule "doesn't work".

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
- **`attendeeCount` (تعداد حاضرین) is nullable and must stay that way.** Null means "the class
  hasn't happened yet", which is different from zero attendance. Never coerce a blank input to
  0 — it changes the meaning and corrupts the manager's show-up rate.
- `school` drives the manager's per-school comparison, so it's a real column, not the freeform
  `reportLabel`. Reports without one group under `بدون مدرسه` so totals still reconcile.
- **School names are managed data** (`schools` table). Persian input varies invisibly —
  Arabic yeh/kaf, ZWNJ, doubled spaces — so `TextNormalizer` folds a canonical form that
  carries the uniqueness, while the typed spelling is what gets displayed. Any new
  user-typed value used as a key needs the same treatment.
- **The login throttle is runtime-configurable** (`app_settings`), and an admin can disable
  it or clear a lock. It locked the admin out of their own system once; a security control
  with no recovery path is a liability. Restarting the API also clears locks (in-memory).
- Password minimum is 8 (`AuthController.MIN_PASSWORD_LENGTH`, mirrored in `lib/api.ts`).
  Changing a *temporary* password does not require the current one — the user just proved it
  at login. Voluntary changes still do.
- Voiding is a **soft delete**. Never hard-delete a report: revisions and audit rows point at it.

## Verifying a change actually works

```bash
docker compose up -d --build
```
App on http://localhost:8088. Demo users (when `DEMO_USERS_ENABLED=true`), password
`Demo12345!`: `operator`, `supervisor`, `manager`, and **`lead`** — which holds
SUPERVISOR *and* MANAGER and is the account to use when checking multi-role behaviour.
Admin comes from `.env`. Seeded users start with `mustChangePassword=true`, which now
shows a dismissible prompt rather than blocking access.

## References

| Resource | Read when... |
| :---- | :---- |
| `docs/architecture.md` | Understanding module boundaries and request flow |
| `docs/api.md` | Adding or changing an endpoint |
| `docs/database-schema.md` | Writing a migration |
| `docs/deployment-and-devops.md` | Changing compose, nginx, or env config |
| `docs/developer-guide.md` | Setting up locally / running tests |
