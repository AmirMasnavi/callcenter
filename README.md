# Call Center Daily Report System (Elm-o-Sanat Aria)

A full-stack, responsive web application for recording, auditing, reviewing, and analyzing call center daily performance reports.

---

## 📑 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Quick Start with Docker](#quick-start-with-docker)
- [Testing on a Phone](#-testing-on-a-phone)
- [Recovering the Admin Account](#-recovering-the-admin-account)
- [Local Development](#local-development)
- [Separate Front-end & Back-end Deployment](#separate-front-end--back-end-deployment)
- [Documentation Index](#documentation-index)
- [License](#license)

---

## 🚀 Overview

The Call Center Report System provides call center agents (operators), supervisors, managers, and system administrators with a unified platform to track outreach metrics, review daily status updates, maintain audit trails, and export statistical reports. 

Designed for high data integrity, the system uses optimistic locking for concurrent report edits, mandatory change justifications, Flyway database migrations, and role-based access control (RBAC).

---

## ✨ Key Features

- **Roles + fine-grained permissions:** a user may hold **any combination** of these roles,
  and the interface shows the union of what they grant. Roles are only a starting point —
  an admin can grant or withhold **individual capabilities** per user (adding users, taking
  Excel/CSV exports, voiding reports, viewing the audit log, and so on), so someone can be
  given one extra ability without being promoted.
  - **Operator:** Submit, update, and manage draft or pending daily reports.
  - **Supervisor:** Review, approve, reject, or request revisions on team reports with recorded audit logs.
  - **Manager:** Access team analytics, high-level dashboards, performance trends, and Excel/CSV exports.
  - **Admin:** Manage user accounts, role assignments, password resets, and user activation states —
    plus authority over every report: review any team's, void/restore, reopen an approved report,
    and view the app as another user (all written to the audit log).

- **Accounts & Appearance:**
  - Passwords are a minimum of 8 characters. A temporary password is changed from the Profile
    page without retyping it, and never blocks access to the app.
  - Light appearance by default, with an explicit light / dark / follow-system choice.

- **Report Lifecycle & Concurrency:**
  - Multiple reports per date per agent with customizable labels/titles.
  - Draft state visible exclusively to the authoring operator.
  - Optimistic locking (`@Version`) prevents overwrite conflicts.
  - Revision history tracking (`report_revisions` table) records `old_values` and `new_values` whenever a reviewed report is amended.

- **Interactive Analytics Dashboard:**
  - Built with Apache ECharts supporting Jalali (Persian) date filters.
  - Visual metrics for total contacts, positive responses (`OK`), potential leads (`Maybe`), negative outcomes (`No`), and unanswered calls.

- **Avatar & Profile Support:**
  - Secure profile avatar upload and binary storage.

- **Attendance & payroll (ورود و خروج):**
  - The office manager records each arrival and departure with one tap; the time is
    pre-filled from the clock and can be adjusted to the minute.
  - Several shifts per person per day are supported — worked time is derived from the
    timestamps, never stored, so a correction can never leave a stale total behind.
  - Payroll sees worked hours against each person's monthly target (default 150, overridable
    per person) **alongside** their call performance for the same range.
  - Excel export with two sheets (summary + day-by-day, mirroring the paper form), and a
    print stylesheet that strips the app chrome.

- **Data Export:**
  - Dynamic export to `.xlsx` (Apache POI) and `.csv` formats.

---

## 🛠 Tech Stack

### Back-end (`services/api`)
- **Runtime:** Java 21
- **Framework:** Spring Boot 4.1.0 (Spring Web, Spring Security, Spring Data JPA, Spring Session JDBC, Actuator)
- **Database:** PostgreSQL with Flyway migration management
- **Documentation & Testing:** OpenAPI 3.0 (SpringDoc), Testcontainers, JUnit 5

### Front-end (`apps/web`)
- **Runtime & Build:** Node.js 22+, Vite, TypeScript
- **Framework:** React 19 SPA
- **State & Data Fetching:** `@tanstack/react-query` v5
- **Data Visualization:** Apache `echarts` & `echarts-for-react`
- **UI Components:** Custom responsive CSS, `react-multi-date-picker` (Jalali calendar integration)

---

## 🐳 Quick Start with Docker

Run the entire stack (PostgreSQL, Spring Boot API, React Web App behind Nginx) with a single command:

```bash
# 1. Copy example environment configuration
cp .env.example .env

# 2. Update default passwords in .env for security

# 3. Build and launch containers
docker compose up --build
```

Access the application at `http://localhost:8088`.

> [!IMPORTANT]
> If you change `APP_PORT`, you must also add the matching origin to `CORS_ALLOWED_ORIGINS` in
> `.env`. The API rejects any browser request whose `Origin` is not on that list, so a mismatch
> makes **every login fail with 403 `Invalid CORS request`** while the containers all report
> healthy. Note that `curl` will still succeed, because it sends no `Origin` header.

### Initial Demo Accounts

> [!IMPORTANT]
> **The admin password is `Demo12345!`** (set by `ADMIN_PASSWORD` in `.env`). Change it after
> your first login, and set `DEMO_USERS_ENABLED=false` for any real deployment.
>
> `ADMIN_PASSWORD` only seeds the account the first time the database is created — changing
> it later does not update an existing admin. To reset a forgotten admin password, use the
> command under [Recovering the admin account](#recovering-the-admin-account).

| Role(s) | Username | Password | Description |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin` | `Demo12345!` | User management, plus full authority over every report |
| **Manager** | `manager` | `Demo12345!` | Overall metrics & team exports |
| **Supervisor** | `supervisor` | `Demo12345!` | Report review & approval workflows |
| **Operator** | `operator` | `Demo12345!` | Daily report entry & editing |
| **Supervisor + Manager** | `lead` | `Demo12345!` | Demonstrates multiple roles on one account |
| **Office manager** | `office` | `Demo12345!` | Records staff arrivals and departures |
| **Payroll** | `payroll` | `Demo12345!` | Worked hours + performance, Excel export |

A user can hold **several roles at once**; the navigation shows the union of everything their
roles grant. Assign roles with the checkboxes in the admin user editor.

*Note: The database user `callcenter` is reserved for PostgreSQL internal connections and is not an application login.*

---

## 📱 Testing on a Phone

The app is responsive; to try it on a real device, put the phone on the **same Wi‑Fi** as
this machine and open the LAN address.

```bash
# Find this machine's LAN address
ipconfig getifaddr en0
```

Then browse to `http://<that-address>:8088` — currently **http://192.168.1.220:8088**.

> [!IMPORTANT]
> The LAN origin must be listed in `CORS_ALLOWED_ORIGINS` in `.env`, or **every login from
> the phone fails with 403** while the desktop keeps working. It is already set to
> `http://192.168.1.220:8088`; if your address changes (a new network, a DHCP lease), update it and
> restart the API:
>
> ```bash
> docker compose up -d --force-recreate api
> ```

---

## 🆘 Master Recovery Code

`MASTER_RECOVERY_CODE` in `.env` is a break-glass back door. When set, two public endpoints
become available:

| Endpoint | Effect |
| :--- | :--- |
| `POST /api/v1/auth/recovery/reset-password` | Set any account's password, reactivate it, clear its login lock |
| `POST /api/v1/auth/recovery/sign-in` | Sign in as any account |

```bash
curl -X POST http://localhost:8088/api/v1/auth/recovery/reset-password \
  -H 'Content-Type: application/json' \
  -d '{"masterCode":"<your code>","username":"admin","newPassword":"NewPassword1"}'
```

> [!CAUTION]
> **Anyone holding this code has total control of every account.** Treat it like a root
> password: keep it out of git, out of screenshots, and rotate it if it is ever exposed.
> Leaving `MASTER_RECOVERY_CODE` empty disables both endpoints entirely.

Safeguards built in: the code is never persisted (only compared against the environment
value, in constant time so it cannot be guessed a character at a time); attempts are
throttled by the same brute-force guard as normal logins; every attempt — success or
failure — is written to the audit log with the target account; and responses are identical
whether or not a username exists, so it cannot be used to enumerate accounts. Signing in
makes you a *real* user bound by that user's permissions, so every subsequent action stays
attributable rather than invisible.

---

## 🔑 Recovering the Admin Account

`ADMIN_PASSWORD` in `.env` only seeds the admin the **first time** the database is created.
Changing it afterwards has no effect on an existing account. If the admin password is lost,
reset the hash directly:

```bash
HASH=$(htpasswd -bnBC 12 "" 'YourNewPassword' | tr -d ':\n')
docker compose exec -T db psql -U callcenter -d callcenter \
  -c "UPDATE app_users SET password_hash='$HASH', must_change_password=false WHERE username='admin';"
```

Too many failed logins locks an account for a while. An admin can relax or switch that off
entirely under **امنیت** in the app, or clear a specific lock. If nobody can get in at all,
restarting the API also clears the locks, since they are held in memory:

```bash
docker compose restart api
```

---

## 💻 Local Development

### Prerequisites
- **Java 21** JDK
- **Maven 3.9+**
- **Node.js 22+** and `npm`
- **PostgreSQL 15+**

### 1. Launch Back-end API
```bash
# From repository root
mvn -pl services/api spring-boot:run
```
The REST API will be available at `http://localhost:8080`.
- OpenAPI documentation: `http://localhost:8080/api-docs` or `http://localhost:8080/swagger-ui.html`
- Health check: `http://localhost:8080/actuator/health`

### 2. Launch Front-end Development Server
```bash
cd apps/web
npm install
npm run dev
```
The Vite development server runs at `http://localhost:5173`. In local mode, requests are automatically proxied to `http://localhost:8080`. Ensure `apps/web/.env.local` remains empty (`VITE_API_BASE_URL=`).

---

## 🌐 Separate Front-end & Back-end Deployment

When deploying front-end and back-end to separate hosts (e.g., Render, Railway, Vercel):

### Front-end Environment Settings
Set the public URL of your backend API during build:
```dotenv
VITE_API_BASE_URL=https://callcenter-api.onrender.com
```

### Back-end Environment Settings
Configure CORS and secure cookie policy:
```dotenv
CORS_ALLOWED_ORIGINS=https://callcenter-web.onrender.com
COOKIE_SECURE=true
```

---

## 📚 Documentation Index

Comprehensive documentation is available in the [`docs/`](docs/) directory:

- 🏗 **[Architecture Overview](docs/architecture.md):** Deep-dive into project structure, data flow, security model, and optimistic locking.
- 🔌 **[API Reference](docs/api.md):** REST endpoints, authentication scheme, payload DTOs, and role permissions.
- 🗄 **[Database Schema](docs/database-schema.md):** PostgreSQL tables, Flyway migrations (`V1`, `V2`, `V3`), indexes, and ER relationships.
- 🚀 **[Deployment & DevOps](docs/deployment-and-devops.md):** Docker Compose configuration, production hardening, environment variables, and database backups.
- 🧑‍💻 **[Developer Guide](docs/developer-guide.md):** Developer environment setup, building artifacts, running unit & integration tests.

---

## 📄 License

Copyright © 2026 Elm-o-Sanat Aria. All rights reserved.
