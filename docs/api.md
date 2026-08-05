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
  > `impersonatedBy` is the id of the admin currently viewing as this user, otherwise `null`.

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
    "totalPeople": 50,
    "contactedCount": 45,
    "okCount": 20,
    "maybeCount": 10,
    "noCount": 10,
    "noAnswerCount": 5,
    "notes": "Successful outreach round."
  }
  ```

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
