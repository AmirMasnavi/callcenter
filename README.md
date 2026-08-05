# Call Center Daily Report System (Elm-o-Sanat Aria)

A full-stack, responsive web application for recording, auditing, reviewing, and analyzing call center daily performance reports.

---

## 📑 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Quick Start with Docker](#quick-start-with-docker)
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

- **Role-Based Access Control (RBAC):** a user may hold **any combination** of these roles,
  and the interface shows the union of what they grant.
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
> Change default temporary passwords upon first login. For production deployments, set `DEMO_USERS_ENABLED=false` in `.env`.

| Role(s) | Username | Temporary Password | Description |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin` | `ChangeMe123!` | User management, plus full authority over every report |
| **Manager** | `manager` | `Demo12345!` | Overall metrics & team exports |
| **Supervisor** | `supervisor` | `Demo12345!` | Report review & approval workflows |
| **Operator** | `operator` | `Demo12345!` | Daily report entry & editing |
| **Supervisor + Manager** | `lead` | `Demo12345!` | Demonstrates multiple roles on one account |

A user can hold **several roles at once**; the navigation shows the union of everything their
roles grant. Assign roles with the checkboxes in the admin user editor.

*Note: The database user `callcenter` is reserved for PostgreSQL internal connections and is not an application login.*

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
