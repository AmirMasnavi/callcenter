# Development Guide

## Purpose

This guide describes how to evolve the Call Center Reporting System safely. The repository is intentionally in a documentation-and-structure baseline: installable application scaffolding is introduced in the delivery phases below, not assumed to exist today.

## Prerequisites

The intended development environment is:

- Java 21 (LTS)
- Maven
- Node.js current LTS and a package manager selected when the web application is initialized
- Docker Desktop for local PostgreSQL and Testcontainers
- PostgreSQL-compatible database (Supabase PostgreSQL is the planned hosted option)

Keep secrets in local environment files or the deployment platform. Never commit them. Copy an eventual `.env.example` to `.env` and fill only local values.

## Repository map

| Path | Responsibility |
| --- | --- |
| `apps/web/` | React 19, TypeScript, Vite, and the responsive user interface |
| `services/api/` | Java 21/Spring Boot API, business rules, authorization, persistence, and OpenAPI |
| `packages/api-contract/` | Versioned shared contract material if the project introduces generated clients or schemas |
| `infrastructure/` | Docker Compose, deployment, and environment-support assets |
| `docs/` | Product requirements, technical documentation, decision records, and runbooks |

## Planned local workflow

Once Phase 1 is implemented, the normal development loop is:

1. Start PostgreSQL using the documented local infrastructure command.
2. Run the API with the `local` Spring profile. The local-only development identity adapter supplies the acting user; it must never be enabled in production.
3. Start the web client from `apps/web/`.
4. Run API tests (unit and PostgreSQL/Testcontainers integration tests) and web tests before submitting work.

Exact commands will be added when the Spring Boot and Vite scaffolds exist. Do not document commands that cannot yet run.

## Building a vertical slice

For a feature, work in this order:

1. Identify the user story and acceptance criteria in the specification.
2. Define or update the REST/OpenAPI contract at `/api/v1`.
3. Add a Flyway migration and database constraints if the model changes.
4. Implement domain validation, state transition, authorization, and transaction behavior in the API.
5. Add unit tests and Testcontainers integration coverage for critical behavior.
6. Implement the smallest matching web flow using translation keys and accessible controls.
7. Add web tests and an end-to-end test for a critical completed workflow.
8. Update this guide, API docs, architecture notes, and `MEMORY.md` when decisions or status change.

## Backend rules

- Organize by feature, not by horizontal technical layer across the whole project.
- Keep controllers responsible for HTTP translation; services/domain components own business decisions and transactions.
- Validate at the HTTP boundary and enforce business invariants in the domain layer and database.
- Return the standard error shape, including `requestId`; return `409 Conflict` for optimistic-lock conflicts.
- Use Flyway only for schema changes. Do not use automatic schema generation as the production migration mechanism.
- Do not expose persistence entities in REST responses.
- Add OpenAPI documentation for public endpoints and keep it consistent with behavior.

## Frontend rules

- Design mobile-first and keep the daily report completion path under one minute.
- Use React Hook Form + Zod for explicit, testable forms, and TanStack Query for server state.
- Show live outcome totals and derived not-contacted count. Disable submission for blocking validation errors, while permitting invalid drafts.
- Keep provisional and approved dashboard values visually and semantically separate.
- Put visible text in i18next resources. Use locale-aware formatting and set document direction for language changes.
- Provide keyboard access, associated labels/errors, non-color status indicators, and tabular equivalents for charts.

## Test expectations

At minimum, cover:

- Report numeric validation and state transitions.
- Duplicate daily-report rejection.
- Authorization decisions for each role.
- Revision/audit creation for corrections and overrides.
- Separation of provisional and approved dashboard totals.
- Form calculations and blocked submission.
- Agent draft-to-submission, supervisor approval, and manager approved-dashboard flow end-to-end.

## Definition of done

A story is complete only when its acceptance criteria, authorization, tests, migration (if needed), OpenAPI, error and empty states, translations, and responsive manual checks are complete. CI must pass and no secrets may be included in the change.
