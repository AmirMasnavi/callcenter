# REST API Specifications

The Call Center System exposes a RESTful JSON API at base path `/api/v1`. Interactive Swagger/OpenAPI documentation is available at `/api-docs` or `/swagger-ui.html`.

---

## 🔐 Authentication Endpoints

### 1. User Login
- **URL:** `POST /api/v1/auth/login`
- **Access:** Public
- **Request Body:**
  ```json
  {
    "username": "operator",
    "password": "Demo12345!"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "id": 4,
    "username": "operator",
    "displayName": "Operator Agent",
    "roles": ["AGENT"],
    "mustChangePassword": true,
    "impersonatedBy": null
  }
  ```
  > `roles` is an **array** — a user may hold several (e.g. `["SUPERVISOR","MANAGER"]`).
  > `permissions` is what clients should key off; roles are only where those came from.
  > `impersonatedBy` is the id of the admin currently viewing as this user, otherwise `null`.

### Permissions

Every endpoint is authorized on a **permission**, not a role. Roles supply defaults, and an
admin may grant or revoke individual capabilities per user — so an operator can be given
`EXPORT_DATA` without becoming a manager.

| Permission | Grants access to | Default roles |
| :--- | :--- | :--- |
| `SUBMIT_REPORTS` | `/api/v1/reports/**` | AGENT |
| `REVIEW_REPORTS` | `/api/v1/supervisor/**` | SUPERVISOR |
| `VIEW_ALL_REPORTS` | every team's reports, `/api/v1/admin/reports` | MANAGER |
| `VIEW_DASHBOARD` | `/api/v1/dashboard/**` | MANAGER |
| `EXPORT_DATA` | `/api/v1/exports/**` | MANAGER |
| `MANAGE_USERS` | `/api/v1/admin/users/**` | ADMIN |
| `MANAGE_ROLES` | editing roles and permissions | ADMIN |
| `VIEW_AUDIT` | `/api/v1/admin/audit` | ADMIN |
| `VOID_REPORT` | void / restore a report | ADMIN |
| `REOPEN_REPORT` | reopen an approved report | ADMIN |
| `IMPERSONATE` | `/api/v1/admin/impersonate/**` | ADMIN |

`GET /api/v1/admin/permissions` returns this catalogue (id, Persian label, default roles).
User create/update accept `grantedPermissions` and `revokedPermissions`; the response
carries `effectivePermissions`, `rolePermissions`, `grantedPermissions` and
`revokedPermissions` so a UI can show where each capability comes from.

### 2. User Logout
- **URL:** `POST /api/v1/auth/logout`
- **Access:** Authenticated Users
- **Response (200 OK):** `{"message": "Logged out successfully"}`

### 3. Get Current User (`/me`)
- **URL:** `GET /api/v1/auth/me`
- **Access:** Authenticated Users
- **Response (200 OK):** Returns current user details and password change status.

### 4. Change Password
- **URL:** `POST /api/v1/auth/change-password`
- **Access:** Authenticated Users
- **Request Body:**
  ```json
  {
    "currentPassword": "Demo12345!",
    "newPassword": "NewSecurePassword"
  }
  ```
- `newPassword` must be at least **8** characters and differ from the current one.
- `currentPassword` is **optional while `mustChangePassword` is true** — the user proved it at
  login moments earlier. It is required for any later, voluntary change.
- **Response:** `204 No Content`.

### 5. Stop Impersonating
- **URL:** `POST /api/v1/auth/stop-impersonating`
- **Access:** A session that is currently impersonating.
- Returns the restoring admin's `Me`. Deliberately lives under `/auth/**`, not `/admin/**`:
  while impersonating, the session no longer holds ADMIN authority and could not reach an
  admin route to get back.

---

## 🖼 Avatars

| Endpoint | Method | Access |
| :--- | :--- | :--- |
| `/api/v1/users/{id}/avatar` | `GET` | Any authenticated user |
| `/api/v1/users/me/avatar` | `POST` | Yourself — set your own picture, no admin needed |
| `/api/v1/users/me/avatar` | `DELETE` | Yourself — remove your picture |
| `/api/v1/admin/users/{id}/avatar` | `POST` | Requires `MANAGE_USERS` |

Images only, 2 MB maximum; both paths share the same validation.

---

## 🛡 Admin Endpoints

All require the `ADMIN` role and write an entry to the audit log.

| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `/api/v1/admin/users` | `GET` / `POST` | List / create users. `roles` is an array. |
| `/api/v1/admin/users/{id}` | `PUT` | Update a user. The last active admin cannot be demoted or deactivated. |
| `/api/v1/admin/reports` | `GET` | Every report, across all teams. |
| `/api/v1/admin/reports/voided` | `GET` | Voided reports. |
| `/api/v1/admin/reports/{id}/void` | `POST` | Soft-delete. Body: `{version, reason}`. |
| `/api/v1/admin/reports/{id}/restore` | `POST` | Undo a void. |
| `/api/v1/admin/reports/{id}/reopen` | `POST` | Approved → `SUBMITTED`/`DRAFT`. Body: `{version, target, reason}`. |
| `/api/v1/admin/impersonate/{userId}` | `POST` | View the app as that user. |

Voiding never deletes a row — revisions and audit entries reference it.

---

## 📊 Daily Report Endpoints

### 1. List / Filter Daily Reports
- **URL:** `GET /api/v1/reports`
- **Access:** Operators (own reports), Supervisors / Managers / Admins (filtered team reports)
- **Query Parameters:**
  - `startDate` (ISO Date: `YYYY-MM-DD`)
  - `endDate` (ISO Date: `YYYY-MM-DD`)
  - `status` (`DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`)
  - `agentId` (Optional agent filter)

### 2. Create Daily Report
- **URL:** `POST /api/v1/reports`
- **Access:** `OPERATOR`, `SUPERVISOR`, `MANAGER`, `ADMIN`
- **Request Body:**
  ```json
  {
    "reportDate": "2026-08-05",
    "reportLabel": "Shift Morning",
    "school": "دبیرستان فردوسی",
    "totalPeople": 50,
    "contactedCount": 45,
    "okCount": 20,
    "maybeCount": 10,
    "noCount": 10,
    "noAnswerCount": 5,
    "attendeeCount": 18,
    "notes": "Successful outreach round."
  }
  ```
  > `attendeeCount` (تعداد حاضرین) is how many actually attended the class. It is
  > **nullable, and null is not zero** — it means the class hasn't happened yet. Never send 0
  > for "unknown". It must not exceed `totalPeople`, but it *may* exceed `okCount`, since
  > someone who answered "maybe" can still turn up.
  >
  > `school` drives the manager's per-school comparison and the second sheet of the Excel
  > export. Reports without one are grouped under `بدون مدرسه`.

### 3. Update Daily Report
- **URL:** `PUT /api/v1/reports/{id}`
- **Access:** Report owner (if in `DRAFT` or `SUBMITTED` state) or Supervisor (with revision reason)
- **Request Body:** Same as creation DTO + optional `version` field for optimistic locking.

### 4. Submit Report for Review
- **URL:** `POST /api/v1/reports/{id}/submit`
- **Access:** Report owner

### 5. Approve Report
- **URL:** `POST /api/v1/reports/{id}/approve`
- **Access:** `SUPERVISOR`, `MANAGER`, `ADMIN`

### 6. Reject Report
- **URL:** `POST /api/v1/reports/{id}/reject`
- **Access:** `SUPERVISOR`, `MANAGER`, `ADMIN`
- **Request Body:** `{"reason": "Incomplete metrics for morning shift"}`

### 7. Get Report Revisions
- **URL:** `GET /api/v1/reports/{id}/revisions`
- **Access:** `SUPERVISOR`, `MANAGER`, `ADMIN`

---

## 📈 Dashboard & Analytics Endpoints

### 1. Dashboard Summary
- **URL:** `GET /api/v1/dashboard/summary`
- **Access:** `SUPERVISOR`, `MANAGER`, `ADMIN`
- **Query Parameters:** `startDate`, `endDate`, `agentId`

### 2. Performance Trends
- **URL:** `GET /api/v1/dashboard/trends`
- **Access:** `SUPERVISOR`, `MANAGER`, `ADMIN`

### 3. Agent Performance Metrics
- **URL:** `GET /api/v1/dashboard/agents-performance`
- **Access:** `SUPERVISOR`, `MANAGER`, `ADMIN`

---

## 📥 Export Endpoints

### 1. Export Excel (`.xlsx`)
- **URL:** `GET /api/v1/export/excel`
- **Access:** `SUPERVISOR`, `MANAGER`, `ADMIN`
- **Response:** Binary Stream (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`)

### 2. Export CSV (`.csv`)
- **URL:** `GET /api/v1/export/csv`
- **Access:** `SUPERVISOR`, `MANAGER`, `ADMIN`
- **Response:** Text Stream (`text/csv; charset=UTF-8`)

---

## 🕐 Attendance & Payroll Endpoints

Worked hours, replacing the paper timesheet. Two permissions split the module: the front desk
records, payroll reads. Every day boundary is **Asia/Tehran**, and every duration is returned
in whole minutes — hours are a display format only.

### Recording — `PERM_RECORD_ATTENDANCE` (role `OFFICE_MANAGER`)

| Endpoint | Purpose |
| :---- | :---- |
| `GET /api/v1/attendance/today` | Every operator with their current state and today's total |
| `POST /api/v1/attendance/{userId}/in` | Clock in. Body `{at?, note?}` — omit `at` for "now" |
| `POST /api/v1/attendance/entries/{entryId}/out` | Clock out. Body `{at?}` |
| `POST /api/v1/attendance/{userId}/manual` | A whole shift recorded after the fact. Body `{entryAt, exitAt, note?}` |
| `GET /api/v1/attendance/{userId}/entries?date=` | One person's shifts on one day, so a past day can be corrected |
| `PUT /api/v1/attendance/entries/{entryId}` | Correct a shift. Body `{entryAt, exitAt, note}` |
| `DELETE /api/v1/attendance/entries/{entryId}` | Remove a shift (audited) |

`manual` always writes a **closed** shift, so it does not contend with the one-open-shift
index and can be filed while that person is currently clocked in. All four writing paths share
`ShiftRules.validate`: entry required, nothing more than five minutes in the future, exit
strictly after entry, and no shift longer than 24 hours. Violations return `400` with a
Persian message.

### Reporting — `PERM_VIEW_ATTENDANCE` (role `PAYROLL`; grantable to manager/supervisor)

| Endpoint | Purpose |
| :---- | :---- |
| `GET /api/v1/attendance/window?days=N` | Resolves the last N **working** days to a date range — the client never does its own weekend maths |
| `GET /api/v1/attendance/report?from=&to=` | Hours *and* call performance per person for the range |
| `GET /api/v1/attendance/report/details?from=&to=` | Every person's day-by-day sheet in one call — what the printable form uses |
| `GET /api/v1/attendance/report/{userId}?from=&to=` | One person's sheet |
| `GET /api/v1/attendance/report.xlsx?from=&to=[&userId=]` | Two sheets: summary, and daily detail laid out like the paper form. `userId` narrows it to one person without changing the shape |

The report covers anyone with hours in the range, **not only active operators** — someone who
left mid-period is still owed the time they worked.

`targetMinutes` is `expectedDays × dailyTargetMinutes`, where `expectedDays` is the working
days the range contains (Fridays excluded) and the daily rate comes from the person's own
`daily_target_minutes`, falling back to the `attendance.daily-target-minutes` setting (300 —
five hours). Thirty working days therefore still comes to 150 hours, while a ten-day window is
measured against fifty rather than against a month it could not reach.

`daysShort` — expected days with no attendance at all — is reported separately from the hours,
because attending eight of ten days and arriving late every day are different problems.

### Presence — `PERM_VIEW_PRESENCE` (manager, front desk, payroll)

`GET /api/v1/attendance/today` — every operator with their current state and today's total.
Held by managers without `RECORD_ATTENDANCE`, so they can see who is in the building while
recording stays the front desk's job.

### Pay periods — `PERM_VIEW_ATTENDANCE`, closing needs `PERM_CLOSE_PAYROLL_PERIOD`

| Endpoint | Purpose |
| :---- | :---- |
| `GET /api/v1/payroll/periods` | Every cycle, newest first. Exactly one is open; it is created lazily on first read |
| `GET /api/v1/payroll/periods/{id}/lines` | Per-person figures. Live for the open cycle, frozen for a closed one |
| `POST /api/v1/payroll/periods/close` | Settles the open cycle and opens the next. Body `{endsOn?, note?}` |

Closing copies each person's totals into `payroll_period_lines` and never recomputes them:
shifts stay correctable indefinitely, and a closed period that recomputed itself would
silently change what somebody was paid months ago. It is **irreversible**, and returns `409`
naming anyone who still has an open shift — an open shift counts as zero minutes and would
otherwise be frozen at nothing.

---

## 👤 User & Avatar Administration

### 1. List Users
- **URL:** `GET /api/v1/admin/users`
- **Access:** `ADMIN`

### 2. Create User
- **URL:** `POST /api/v1/admin/users`
- **Access:** `ADMIN`

### 3. Reset Password
- **URL:** `POST /api/v1/admin/users/{id}/reset-password`
- **Access:** `ADMIN`

### 4. Upload Avatar
- **URL:** `POST /api/v1/users/me/avatar`
- **Access:** Authenticated Users
- **Content-Type:** `multipart/form-data` (`file`)
