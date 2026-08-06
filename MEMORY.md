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

### 2026-08-05 — Attendance tracking, self-service avatars, contrast fixes

**تعداد حاضرین (attendance).** The number who actually turned up in class — the figure that
says whether the calls worked, as opposed to how many people were reached. Added as a
nullable column (V7) and carried through the whole chain: operator enters it, supervisor can
correct it on review (it counts as a change, so a reason is required), manager sees it
immediately as a KPI, per-operator column, and in both exports.

**Nullable is load-bearing:** null means "the class hasn't run yet", which is not the same as
zero attendance. The operator form keeps the field as `''` rather than 0 for exactly this
reason, and the dashboard treats null as zero only when summing.

**`school` is a real column**, not the freeform `reportLabel`, because managers compare per
school and a free-text label can't be grouped reliably. Reports without one fall into
`بدون مدرسه` so the per-school totals still reconcile with the headline numbers.

**Self-service avatars.** `POST/DELETE /api/v1/users/me/avatar` — users set their own picture
without an admin. Validation is shared with the admin path so both reject the same things.

**Three contrast/layout bugs:**
1. `.page-head h1` hardcodes `#102a45` instead of a token, so the dark remap never reached it
   and the page title was invisible. Now bound to `--heading`.
2. `.report-tabs button.new` sets `color: var(--blue)` and is declared *after* `.active`, so
   on the "+ new report" chip — which has both classes — blue text sat on a navy fill. This
   was broken in light mode too, and pre-dated my changes.
3. `.equation`, `.day-report-bar` and `.validation-list` still painted light in dark mode.

Found #3 by scanning computed styles in the live page for light backgrounds and sub-4.5:1
text, not by eye. Both themes now scan clean. **Use that scan after any CSS change** — it
catches what a screenshot doesn't.

Bottom-nav active indicator moved from above the icon to under the label, where it reads as
"you are here" rather than a stray divider.

### 2026-08-05 — Managed schools, configurable login guard, admin recovery

**Admin lockout.** The login throttle locked the admin out with no way back in, and
`ADMIN_PASSWORD` in `.env` only seeds the account on first database creation — changing it
afterwards does nothing. Reset the hash directly (documented in the README under
"Recovering the Admin Account"); the password is now `Demo12345!`.

The throttle itself is now runtime-configurable via `app_settings`: an admin can change the
thresholds, clear a specific lock, or switch it off, from **امنیت** in the app. It also
returns 429 instead of a generic 409. **A security control with no recovery path is a
liability** — that is the lesson worth keeping.

**Managed school names (V8).** School was free text, so "دبیرستان فردوسی" and the same name
with an Arabic yeh or a doubled space became separate rows in the per-school comparison.
`schools` now holds the list, with `TextNormalizer` producing a canonical form that carries
the uniqueness while the typed spelling is displayed. The migration adopts existing values
and folds duplicates. Verified: adding "دبيرستان  فردوسي" is rejected against the existing
"دبیرستان فردوسی". Deactivate rather than delete — reports reference the name.

New permissions `MANAGE_SCHOOLS` (manager + admin) and `MANAGE_SETTINGS` (admin).

**CSV export** added to the tables that were missing it (users, audit, per-school,
per-agent, schools) via `lib/exportTable.ts`. Note `ManagerPage` already had a local
`download()` for the server endpoints — the import is aliased to `saveFile` to avoid the
shadowing that silently broke the build.

**LAN testing.** `CORS_ALLOWED_ORIGINS` must include the phone's origin
(`http://<lan-ip>:8088`) or every login from the phone 403s while desktop keeps working.

### 2026-08-05 — The iOS zoom, and admin-panel IA

**The "strange zoom" was never a layout bug.** Mobile Safari force-zooms whenever a focused
form control has a font-size under 16px, and it does not zoom back out — so the app appeared
permanently zoomed after the first tap on any field. One 14px input was enough. Fixed by
flooring form controls at 16px on mobile.

**Admin navigation was ranked globally**, which put «ثبت گزارش» in front of an admin and
buried «کاربران». Destinations are now ordered per persona: an admin gets users/security/
schools/dashboard, an operator gets report/history. An admin holds every permission, so
"what they can reach" is a terrible proxy for "what they do daily".

Per-user permission overrides were removed from the UI (the backend still supports them) —
they were unreliable and not needed day to day. Roles moved from four large cards to compact
rows so the list survives growing past four.

School editing now opens a sheet for that row instead of pushing the name back into the "add"
form at the top of the page, and row actions are icons.

**RTL gotcha:** `inset-inline-start` is the RIGHT edge, so an absolutely-positioned action
landed on top of the avatar. Always check which physical side a logical property resolves to.

### 2026-08-05 — Desktop chrome, stranded dark-sidebar styles

**The bottom bar appeared on desktop** beside the sidebar: my rebuild set `display: flex`
with no breakpoint, overriding the base sheet's mobile-only rule. Both mobile chrome
elements are now explicitly hidden above 900px, and 900px is the single breakpoint (I had
drifted between 900 and 980).

**The logout icon resisted four separate fixes** because `usability.css` set its colour,
background and border with `!important` — left over from when the sidebar was a dark navy
gradient. Removing those (rather than escalating the !important war) took it from 1.32:1 to
7.56:1. The wider lesson: the sidebar's children are still styled for a dark panel, so
anything added there needs a token-based override, and a rule that "doesn't work" is worth
checking for `!important` before adding specificity.

The mobile brand header is static, not sticky — content was passing under it.

**Supervisor review on mobile**: the detail panel was stacked below the queue, a full screen
down, so selecting a report looked like nothing happened. Below 900px the two are now one
view at a time with a back control. Status chips got consistent sizing.

### 2026-08-05 — Archive, queue ordering, admin landing page

**Archive (V9)** is deliberately distinct from void:
- *voided* = the report is wrong → excluded from every statistic
- *archived* = the report is finished with → leaves the working lists ONLY

Archived reports still count in the dashboard and exports. Getting this backwards would
mean tidying a queue silently changed the manager's numbers. `aggregateSource` therefore
does NOT filter archived, while every working list does. Bulk by design — a backlog is
cleared in batches. Permission `ARCHIVE_REPORTS` (supervisor + manager + admin).

**Queue ordering** was `order by submittedAt` (oldest first). Now newest first.

**Admin landed on «ثبت گزارش»** because `home` used the raw NAV order rather than the
persona ranking the bottom bar uses. Both now share `primaryNav`.

Two bugs caught only by checking, not by the build:
- One of four archive filters silently didn't apply (the string I was replacing had
  drifted), so archived reports leaked into the team list while the pending endpoint was
  correct. Verified by comparing the two endpoints rather than trusting the edit.
- A permission test asserted SUPERVISOR's *only* default is REVIEW_REPORTS; giving the
  role ARCHIVE_REPORTS broke it. The assertion was too tight — it now checks the revoked
  capability specifically and that the role's other defaults survive.

### 2026-08-05 — Two self-inflicted layout bugs, and admin nav scope

Adding bulk-archive broke the supervisor queue in two ways, both mine:
1. The checkbox went in as the FIRST child of `.queue button`, which shifted the base
   sheet's `div:nth-child(2) { flex: 1 }` off the text block and onto the avatar — so the
   avatar stretched into a long ellipse. Fixed by appending it LAST and using `order: -1`
   to place it visually first. **Positional CSS selectors make DOM order load-bearing.**
2. The bulk bar was added as a direct child of the two-column `.review-layout` grid, so it
   consumed a grid cell and pushed the review card into the wrong column. Toolbars go
   outside the grid.

**Admin navigation now excludes report filing entirely** (`ADMIN_IRRELEVANT` in App.tsx).
An admin holds every permission, so "can reach" was a poor filter for "should see" — and
if they ever need an operator's view, impersonation already exists. The desktop sidebar
also ranks by persona now; it had been rendering NAV in declaration order, which is why
"ثبت گزارش" sat at the top for an admin.

### 2026-08-05 — Decluttering, and the ledger/archive relationship

**Impersonation bar overlapped everything** — it is fixed chrome, but the sidebar is also
fixed at top:0 and content starts at 0. The shell now gets an `.impersonating` class and
shifts everything down by exactly the bar height.

**Filters and exports left the dashboard toolbar.** Only the date range stays visible (it
frames every number on the page); supervisor/operator filters and the Excel/CSV buttons
open in sheets. A dot on the filter chip marks "something is narrowed" without a count.

**The report ledger moved to its own page** (`/app/ledger`) with search and status tabs. A
manager opening the dashboard wants charts; the ledger is a lookup tool reached
deliberately, and at the bottom of the main page it got worse with every report filed.

**Three list scopes now exist, and the distinction matters:**
- working lists (`allReports`, `teamReports`, `pending`) — exclude archived AND voided
- ledger (`ledger()`) — excludes voided, **includes archived**, because "archived, not
  deleted" is only true if the reports stay findable
- statistics (`aggregateSource`) — excludes voided, includes archived

Caught this because the ledger showed 5 of 41 reports: it was reusing the working-list
endpoint, so archiving would have made reports effectively disappear — exactly what the
user asked not to happen.

### 2026-08-05 — Account settings sectioned, user search

Profile became a grouped list you step into (identity card, then rows for appearance and
password, then sign-out on its own). Each row shows its current value — "روشن", or "موقت"
when the password is still temporary — so the setting is readable without opening it.
Three stacked cards had made a rarely-used screen look busy.

Admin user list gained search over name, username and **role label**, so typing "ناظر"
finds every supervisor. CSV export follows the filtered list, not the full one — what you
download matches what you were looking at.

### 2026-08-05 — Attendance and payroll (V10)

Replaces the paper timesheet. Two new roles: `OFFICE_MANAGER` (مسئول دفتر) records
arrivals/departures, `PAYROLL` (مسئول حقوق و دستمزد) reads hours + performance. Manager and
supervisor can be granted `VIEW_ATTENDANCE` on its own without changing their role.

Decisions worth keeping:
- **Worked minutes are DERIVED, never stored.** A stored duration goes stale the moment
  either timestamp is corrected, and payroll is exactly where that must not happen.
- **All arithmetic in whole minutes**, formatted to hours only for display — summing
  fractional hours drifts.
- **Days are bounded in Tehran time, not UTC.** 21:00 UTC is already the next day locally;
  UTC bucketing would file shifts under the wrong date. A test pins this down (my first
  version of that test asserted the wrong date — the code was right).
- **Several shifts per day**, with a partial unique index enforcing at most one OPEN shift
  per person, so a second clock-in without clocking out is rejected rather than silently
  creating an orphan.
- Monthly target is per person, `NULL` meaning "use the default" — so changing the default
  moves everyone who has not been given a specific figure.
- The report is over **real clock time in the range**, not days × nominal hours. That is the
  distinction the paper process could not enforce and the whole point of the feature.

### 2026-08-06 — Finishing the attendance module: what a walkthrough caught

The feature worked on the happy path; walking it at 390px and 1280px in both themes turned
up ten defects, most of them the same two mistakes repeated.

**Mistake one — `toISOString()` used as "today".** It is UTC. Tehran is UTC+3:30, so from
20:30 UTC onward the two disagree, and the module is used in the evening. Every date default
(manual entry, corrections, the payroll range) preselected *and capped at* yesterday, and the
30-day range silently dropped the current day. All now use the Tehran-based `todayIso()` that
`JalaliDate.tsx` already exported. **Anywhere a date is defaulted, check which clock it came
from.**

**Mistake two — validation duplicated per code path.** `recordManual` checked future times
and a 24-hour cap; `adjust` checked neither, and wrote `exitAt` *before* validating it. A
correction could therefore store a shift that manual entry would refuse, and clearing an exit
reopened a closed shift — which collides with the one-open-shift index and surfaces as a 500
instead of a Persian message. Extracted to `ShiftRules.validate(entry, exit, now)`, injected
`now` so boundaries are testable, and all four paths call it. 13 tests.

Other things worth remembering:
- **`asHours` mixed digit systems** — Persian hours, Latin minutes ("۳:12"), because
  `String(m).padStart` bypassed `fa()`. Every total on the page had it and nobody noticed
  until the number was read aloud. Pad *after* formatting, with `'۰'`.
- **`report()` listed only active operators**, so someone deactivated mid-period vanished
  along with hours they are still owed. Payroll must cover anyone with hours in the range.
- **An overnight shift could not be entered at all** — exit ≤ entry read as invalid rather
  than "next morning". The paper form recorded it as one line; so do we now.
- **`window.print()` was called from a render body** behind a `window.__printed` global, and
  the printable view fetched one report per person — each of which recomputed the entire
  report server-side. Now a bulk `/report/details` endpoint and a real effect that prints
  after two animation frames (a timeout is a guess about how slow the device is).
- **`.charts` is the dashboard's two-column grid.** Reusing it for a single chart made the
  section title consume one cell and squeezed the chart into a third of the page. New
  full-width panels get `.chart-card`.
- **Four columns do not fit a 347px screen.** Both the staff list and the timesheet rows had
  avatar + name + button + icon in one flex row; names broke over two lines and status text
  over four. Both now switch to a two-row grid under 700px.
- **Manual entry opened in an error state every morning** — its default 14:00–19:00 window
  had not happened yet, so the form said "این زمان هنوز نرسیده است" before anything was
  typed. It now starts on the last day that window actually finished.
- The seeder guarded on `reports.count() > 0`, so operators added later got nothing. Guarding
  **per operator** means a new account gets a history and existing data is never touched.

### 2026-08-06 — v2: what the targets actually mean, and pay cycles

The user's sharpest note this round was that a ten-day view was being measured against a
150-hour month. That is not a display bug; the number was answering a question nobody asked.

**The target is a daily rate now** (`attendance.daily-target-minutes`, 300 = five hours), and
a period's target is `expectedDays × rate`. Thirty working days is still 150 hours, so a full
cycle is unchanged, but every shorter window finally has a denominator it can reach. Two
consequences worth remembering:
- **"۳۰ روز" means thirty working days**, so it spans 34 calendar days — the Fridays inside
  are skipped. The client asks `/attendance/window?days=N` instead of doing its own date
  maths, so there is one definition of where the weekend falls.
- **`daysShort` is separate from the percentage.** Turning up for eight of ten days and
  turning up late every day both produce "80%", and they need different conversations.

**Pay cycles (V12).** The screen could only ask "what do the last N days look like right
now" — a moving window, so the same question a week later gives a different answer and there
was no record of what was settled. Closing a period freezes every figure into
`payroll_period_lines` and opens the next one the day after.
- Frozen, **not recomputed**: shifts stay correctable forever, so a closed period that
  recomputed itself would change what someone was paid months ago. The display name is copied
  for the same reason.
- Closing **refuses while anyone is clocked in** and names them. An open shift is worth zero
  minutes, so it would freeze their day at nothing with no way back.
- Closing is irreversible by design. A reopenable period is a draft, not a record.
- Two bugs found while building it:
  - Hibernate orders **inserts before updates** within a flush, so inserting the next period
    happened while the old one was still open and `idx_payroll_one_open_period` rejected it.
    `saveAndFlush` on the close, then insert.
  - The next cycle starts tomorrow, so for the rest of the closing day the "current" period
    lies entirely in the future — the screen opened on it and looked broken. The view now
    opens on a cycle that has actually started, and the future one is labelled «هنوز شروع نشده».

**Export.** The user said twice they could not tell what the print button produced. That is
the answer: an icon with a tooltip is not an explanation. One sheet now states the active
range, offers everyone or one person, and describes each output in a sentence — and the
printed page says on itself what it is for.

**Production defaults.** `DEMO_USERS_ENABLED` defaulted to **true** in compose, so a deploy
that forgot its `.env` would quietly create real accounts with a published password. Now
false; development opts in through `.env`. Worth re-checking any other `:-true` default that
creates data or relaxes a control.

**Contrast auditing has a measurement trap.** Running the scan 1.5s after a route change
reported 8–33 failures on every page, including nonsense like the same two strings failing on
screens that do not contain them. React keeps the outgoing tree mounted during a Suspense
transition, and the theme transition is still running — so the scan reads a blend of two
pages mid-fade. At 2.5s+ the same pages come back clean. **Wait for the page to settle before
measuring, and be suspicious of a failure that appears on every route.** One genuine bug did
hide in that noise: the counts inside the new role-filter chips were at `opacity: 0.75` over
an already-tinted background, giving 2.56:1. Fading text over a tint is what costs the
contrast; size and weight make something secondary for free.

**Deploying broke open sessions.** Found by accident: after rebuilding the web container, a
tab that had been open went blank with "Failed to fetch dynamically imported module". Every
build renames the hashed chunks and deletes the old ones, so an open tab is holding an
`index.html` pointing at files that no longer exist — and React renders nothing when a lazy
import rejects. Every user would have hit this on every deploy. `lib/lazyPage.ts` reloads once
(sessionStorage timestamp guard, so a genuine failure rethrows instead of looping); verified
by deploying a new build with a tab open and confirming it recovers rather than dying.

**Bundle.** `echarts-for-react` pulls the entire library — every chart type, map and GL
renderer — for the three types this app draws. `lib/echarts.tsx` registers only those:
1146 kB → 587 kB (386 → 201 kB gzipped).

## Known Issues

- **`LoginGuard` is in-memory per instance** (`ConcurrentHashMap`). Brute-force throttling is
  bypassable behind more than one API replica, and resets on restart. Fine at current scale;
  move to Redis/DB before scaling out.
- **`LoginGuard` lockout returns HTTP 409**, because it throws `IllegalStateException`.
  Semantically should be 429.
- **`ReportService.snapshot()` still hand-builds JSON via string concatenation.** It now
  escapes backslashes, quotes, newlines, CR and tabs (fixed 2026-08-05), so the output is
  valid — but it should still use Jackson rather than an ad-hoc escaper.
- ~~`AdminController.apply()` does not validate `supervisorId`~~ — fixed 2026-08-05.
- ~~No self-lockout guard in admin user editing~~ — fixed 2026-08-05 (`guardLastAdmin`).
- **The older stylesheets (`styles.css`, `usability.css`, 1.8k lines) hardcode a light
  palette.** `theme.css` remaps them for dark mode selector-by-selector. Any new surface
  added to the old sheets needs a matching `[data-theme='dark']` rule or dark mode breaks
  in that one spot. Converting those sheets to tokens would remove the whole class of bug.
- **Avatar fetch is open to any authenticated user** (`GET /api/v1/users/{id}/avatar`), with
  no role or team scoping.
- **Test coverage is still thin** — 54 backend tests (report rules, permissions, text
  normalization, shift arithmetic, shift validation) and 2 frontend tests. Testcontainers is
  on the classpath but no integration test uses it. Pure rules are covered; route-level
  authorization, persistence and the whole frontend are only verified by hand.
- **`<input type="time">` renders in the browser's locale**, so on an en-US browser the
  attendance sheet shows "02:00 PM" rather than 24-hour. It will read correctly on a machine
  set to Persian/Iran, but the page cannot force it.
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
