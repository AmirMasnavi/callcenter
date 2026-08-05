# Architecture Overview

This document describes the high-level architecture, design decisions, monorepo layout, security model, and data flow patterns of the Call Center Report System.

---

## 🏛 System Architecture

The application adopts a decoupled Client-Server architecture organized as a Monorepo:

```
+-------------------------------------------------------------------+
|                        Client Layer (SPA)                         |
|  React 19 + TypeScript + Vite + TanStack Query + ECharts          |
|  Location: apps/web                                               |
+-------------------------------------------------------------------+
                                 │
                                 │ HTTPS / REST API (Session Cookie / JSON)
                                 ▼
+-------------------------------------------------------------------+
|                        Application Layer                          |
|  Spring Boot 4.1.0 (Java 21)                                      |
|  Location: services/api                                           |
|                                                                   |
|  [Security Filter] -> [Controller Layer] -> [Service Layer]       |
|                                                    │              |
|                                            Spring Data JPA        |
+----------------------------------------------------+--------------+
                                                     │
                                                     ▼
+-------------------------------------------------------------------+
|                         Persistence Layer                         |
|  PostgreSQL 15+ (Session JDBC + Flyway Migrations)                |
+-------------------------------------------------------------------+
```

---

## 📁 Repository Directory Structure

```
call-center/
├── .env.example              # Sample root environment file
├── docker-compose.yml        # Multi-container orchestration (DB, API, Web)
├── pom.xml                   # Root Maven Parent POM
├── docs/                     # Comprehensive technical documentation
│   ├── api.md
│   ├── architecture.md
│   ├── database-schema.md
│   ├── deployment-and-devops.md
│   └── developer-guide.md
├── services/
│   └── api/                  # Spring Boot 4 Back-end Application
│       ├── Dockerfile
│       ├── pom.xml
│       └── src/
│           ├── main/
│           │   ├── java/com/elmosanatearia/callcenter/
│           │   │   ├── audit/       # System audit logging domain
│           │   │   ├── auth/        # Spring Security & Auth controllers
│           │   │   ├── common/      # Exception handlers & global utilities
│           │   │   ├── config/      # CORS, Security, Web MVC configuration
│           │   │   ├── dashboard/   # Analytics & Excel/CSV exports
│           │   │   ├── report/      # Daily reports domain & optimistic locking
│           │   │   └── user/        # User management & avatars
│           │   └── resources/
│           │       ├── application.yml
│           │       └── db/migration/ # Flyway SQL migrations
│           └── test/                 # Test suites (JUnit 5, Testcontainers)
└── apps/
    └── web/                  # React 19 / TypeScript Front-end Application
        ├── Dockerfile
        ├── nginx.conf
        ├── package.json
        ├── vite.config.ts
        └── src/
            ├── App.tsx       # Root layout & routing
            ├── components/   # UI components (Header, Modals, Forms)
            ├── pages/        # Dashboard, Reports, Admin pages
            ├── lib/          # API client & React Query hooks
            └── styles.css    # Responsive styles
```

---

## 🔐 Security & Access Control Model

### Authentication Mechanism
- **Session-Based Authentication:** Uses `Spring Session JDBC` to persist user sessions in PostgreSQL (`SPRING_SESSION` tables).
- **HTTP Cookies:** Session ID is transmitted via HttpOnly, SameSite cookies. `COOKIE_SECURE=true` can be enforced in production HTTPS deployments.
- **Login Rate Guard:** Includes `LoginGuard` to mitigate brute-force password guessing attempts.

### Role Hierarchy
The system enforces strict role-based access control (RBAC) via `Role` enum:

```
                ┌──────────────┐
                │  ROLE_ADMIN  │  (User management, account reset/activation)
                └──────┬───────┘
                       │
                ┌──────▼───────┐
                │ ROLE_MANAGER │  (Team dashboard, performance analytics, exports)
                └──────┬───────┘
                       │
              ┌────────▼────────┐
              │ ROLE_SUPERVISOR │ (Report reviews, approvals, revisions)
              └────────┬────────┘
                       │
               ┌───────▼────────┐
               │ ROLE_OPERATOR  │ (Report creation, draft submission, updates)
               └────────────────┘
```

---

## ⚡ Concurrency & Data Integrity

### Optimistic Locking
To prevent lost updates when multiple users access or modify daily reports:
- The `daily_reports` table contains a `version` column (`BIGINT NOT NULL DEFAULT 0`).
- JPA entity `DailyReport` is annotated with `@Version`.
- If two updates race against the same report, JPA throws an `OptimisticLockingFailureException`, which is caught and returned as a clear HTTP 409 Conflict error.

### Revision History Audit
- When a report that has already been approved/reviewed requires correction, the revision must be submitted with a mandatory justification (`reason`).
- The `ReportService` writes an immutable record to `report_revisions` containing:
  - `actor_id`: User making the amendment.
  - `reason`: Justification text.
  - `old_values`: JSON string of metrics prior to edit.
  - `new_values`: JSON string of metrics post edit.

### System Audit Trail
- System actions (user logins, account modifications, status transitions) trigger `AuditEvent` records stored in `audit_events`.
