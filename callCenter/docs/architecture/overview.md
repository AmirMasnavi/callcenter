# Architecture Overview

## Baseline

The system is a modular monolith. A React web client calls a Java Spring Boot REST API, which is the owner of reporting writes, workflow rules, authorization, audit events, and database access. PostgreSQL stores operational data.

```text
React web client
       |
       | HTTPS /api/v1
       v
Spring Boot API (modular monolith)
       |
       v
PostgreSQL
```

External authentication is a later boundary: the client obtains an identity token, Spring Security validates it, and the API maps its subject to an internal user whose role determines application permissions.

## Module boundaries

| Module | Owns |
| --- | --- |
| `auth` | Actor context and eventual JWT integration |
| `user` | Internal users, roles, active status, language preference |
| `report` | Daily reports, validation, drafts, submission, state transitions |
| `dashboard` | Independent provisional and approved aggregation queries |
| `audit` | Activity logging and append-only report revisions |
| `export` | CSV exports using the same filtering/aggregation basis as dashboard views |
| `common` | Shared errors, request IDs, pagination, and cross-cutting utilities |
| `config` | Security, CORS, OpenAPI, and serialization configuration |

## Data ownership

The core entities are `User`, `DailyReport`, `ReportRevision`, and `ActivityLog`. `DailyReport` has a unique `(agent_id, report_date)` constraint and an optimistic-locking version. Revisions preserve original and changed values; activity logs record security-sensitive and business-critical actions.

See [domain rules](domain-rules.md) for behavior that must remain consistent across API, database, dashboard, and export code.
