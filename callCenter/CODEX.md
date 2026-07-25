# CODEX.md

## Project

Call Center Reporting System is a mobile-first reporting tool for **aggregated end-of-day statistics**. It has four roles: Agent, Supervisor, Manager, and Administrator. The planned architecture is a modular monolith with a React/TypeScript client, Java 21/Spring Boot API, and PostgreSQL.

This is not a CRM, telephony system, individual-call store, native app, microservice system, or real-time/event-streaming platform.

## Memory system

Read `MEMORY.md` at the start of every session before making changes. It records current status, architectural decisions, and open questions.

When the user says “remember this,” update `MEMORY.md` immediately. Put enduring rules in this file; put changing facts, decisions, and status in `MEMORY.md`.

## Delivery approach

Work backend-first but in small contract-driven vertical slices:

1. Define the API contract for one use case.
2. Implement its migration, backend behavior, validation, authorization, and tests.
3. Build the minimal matching frontend flow.
4. Verify the complete flow before taking the next slice.

The first vertical slice is: a development agent saves a daily-report draft through the React client and the Spring Boot API persists it in PostgreSQL.

## Non-negotiable domain rules

- Each agent may have one report per report date.
- Drafts may be incomplete or invalid; submitted reports must be valid.
- All numeric values are whole, non-negative numbers.
- `contactedCount <= totalPeople`.
- `okCount + maybeCount + noCount + noAnswerCount = contactedCount`.
- `notContactedCount` is derived, never persisted.
- Normal workflow: `DRAFT -> SUBMITTED -> APPROVED` or `CORRECTED_AND_APPROVED`.
- Corrections and locked-report overrides require a reason and append-only revisions/audit events.
- Official totals include only `APPROVED` and `CORRECTED_AND_APPROVED`; provisional data must always be labeled and kept separate.
- Use optimistic locking. Stale writes return HTTP 409 with a usable error response.

## Security and authorization

- Backend authorization is authoritative; frontend visibility is only a usability aid.
- Roles are stored in the application database.
- Authentication proves identity; application services determine business authorization.
- External authentication is deferred. A local-only development identity adapter may use `X-Dev-User-Id`; it must not start in production.
- Never commit secrets or log credentials/tokens.

## Engineering conventions

- Backend code is organized by feature under `services/api/src/main/java/com/callcenter/` (for example `report`, `user`, `dashboard`, `audit`, `export`, `auth`, `common`, `config`). Keep controllers thin; put business rules and transactions in services/domain components.
- Do not expose JPA entities as API responses. Use DTOs, validation, and mappers.
- Use Flyway migrations for every schema change. Constraints must reinforce application rules.
- Share dashboard/export filtering and aggregation logic where practical so totals cannot diverge.
- Public API base path is `/api/v1`; maintain OpenAPI documentation with any endpoint change.
- All visible frontend strings use translation resources. Backend enums and API values stay language-neutral. English ships first; Persian RTL follows after core workflow stabilizes.
- Build accessible, responsive interfaces; core workflow targets WCAG 2.1 AA practices.

## Quality gate

For every completed story: meet acceptance criteria, add/update automated tests, add a migration when needed, update OpenAPI and relevant docs, handle authorization/error/empty states, use translation keys for UI text, and verify mobile plus desktop behavior.

## Documentation map

| Document | Read when… |
| --- | --- |
| `docs/development-guide.md` | Setting up, running, testing, or adding a feature |
| `docs/architecture/overview.md` | Making architecture or boundary decisions |
| `docs/architecture/domain-rules.md` | Working on reports, workflow, totals, or audit history |
| `docs/api/api-conventions.md` | Adding or modifying an endpoint |
| `docs/decisions/` | Evaluating previously made architecture decisions |
| `docs/description/Call_Center_Reporting_System_Project_Specification.md` | Needing complete product requirements |
