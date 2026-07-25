# Call Center Reporting System

## Project Specification and Implementation Roadmap

**Document status:** Initial baseline  
**Primary language:** English  
**Planned secondary language:** Persian (RTL)  
**Architecture:** React client + Java Spring Boot API + PostgreSQL  
**Delivery approach:** Backend-first, contract-driven, iterative vertical slices

---

## 1. Executive Summary

The Call Center Reporting System is a mobile-first web application for recording aggregated end-of-day call-center statistics, reviewing and approving reports, and presenting reliable operational dashboards.

The first release intentionally focuses on four capabilities:

1. Agents record one aggregated daily report.
2. Supervisors review, correct, and approve submitted reports.
3. Managers see provisional and approved statistics separately.
4. Administrators manage users, roles, locked reports, and audit history.

The MVP does not record individual calls and is not a CRM, telephony platform, AI analytics system, or native mobile application.

---

## 2. Product Vision

Create a simple, trustworthy, and extensible reporting tool that replaces paper forms and manual aggregation while remaining fast enough for daily operational use.

### 2.1 Product goals

- Allow an agent to complete a daily report in less than one minute.
- Eliminate manual calculation and paper-based reporting.
- Make submitted information visible to managers immediately.
- Clearly distinguish provisional data from approved official data.
- Allow supervisors to correct data without losing the original values.
- Maintain complete traceability for sensitive changes.
- Establish a clean technical foundation for multilingual and future functionality.

### 2.2 Success criteria

The MVP is successful when:

- An agent can create and submit a valid report in under one minute.
- Invalid totals are identified before submission.
- A manager sees a submitted report immediately.
- A supervisor can review, correct, and approve the report.
- Every correction records the actor, timestamp, old value, new value, and reason.
- Raw and approved totals cannot be confused.
- Reports can be filtered by date and agent.
- CSV exports match dashboard totals.
- Users can access only the functions permitted by their role.
- Approved reports cannot be changed without elevated permission and an audit record.

---

## 3. Scope

### 3.1 MVP scope

- Responsive web application
- Aggregated daily report entry
- Draft and submission workflow
- Supervisor review and approval
- Manager dashboard
- Raw versus approved statistics
- User and role management
- Audit trail and report revisions
- Date and agent filters
- CSV export
- English interface with internationalization infrastructure
- Persian translation and RTL support after the core English workflow is stable

### 3.2 Explicitly out of scope

- Recording individual calls
- Automatic call assignment
- CRM functionality
- VoIP or telephony integration
- Audio uploads
- SMS or WhatsApp notifications
- AI analysis or forecasting
- Complex agent ranking
- Full multi-tenant support
- Native Android or iOS applications
- Microservices
- Event streaming platforms
- Real-time WebSocket updates unless a validated requirement appears

---

## 4. Users and Roles

### 4.1 Agent

The agent records one aggregated report at the end of the working day.

Permissions:

- Create a daily report.
- Save an incomplete report as a draft.
- Edit their own draft.
- Submit a valid draft.
- View their own previous reports and statuses.
- View but not edit a submitted or approved report.

### 4.2 Supervisor

The supervisor validates submitted reports.

Permissions:

- View submitted reports.
- Filter by date and agent.
- Inspect validation warnings and totals.
- Correct values with a mandatory reason.
- View revision history.
- Approve reports.

### 4.3 Manager

The manager consumes operational and official statistics.

Permissions:

- View all reports.
- View submission and approval status.
- View raw and approved totals separately.
- View performance by agent.
- Filter by date range and agent.
- Identify corrected or problematic reports.
- Export filtered data to CSV.

### 4.4 Administrator

The administrator has elevated system access.

Permissions:

- Create, update, activate, and deactivate users.
- Assign roles.
- View and edit all reports.
- Override locked reports in exceptional cases.
- Manage basic configuration.
- View complete activity logs.
- Manage supervisors and agents.

Every administrator action that changes business data must be audited.

---

## 5. Permission Matrix

| Capability | Agent | Supervisor | Manager | Administrator |
|---|---:|---:|---:|---:|
| Create own report | Yes | No | No | Yes |
| Edit own draft | Yes | No | No | Yes |
| Submit own report | Yes | No | No | Yes |
| View own reports | Yes | Yes | Yes | Yes |
| View all reports | No | Yes | Yes | Yes |
| Correct submitted report | No | Yes | No | Yes |
| Approve report | No | Yes | No | Yes |
| View dashboard | Limited | Yes | Yes | Yes |
| Export CSV | No | Yes | Yes | Yes |
| Manage users | No | No | No | Yes |
| View complete audit log | No | Limited | Limited | Yes |
| Override locked report | No | No | No | Yes |

Backend authorization is authoritative. Hiding a frontend control is not a security boundary.

---

## 6. Core Workflow

```text
Agent creates report
        |
        v
DRAFT
        |
        | submit valid report
        v
SUBMITTED
        |
        +----------------------+
        |                      |
        v                      v
Supervisor approves     Supervisor corrects
        |                      |
        v                      v
APPROVED          CORRECTED_AND_APPROVED
```

### 6.1 State rules

- `DRAFT`: editable by the owning agent.
- `SUBMITTED`: read-only for the agent; available for supervisor review.
- `APPROVED`: locked for normal users.
- `CORRECTED_AND_APPROVED`: locked and accompanied by revision records.
- An administrator override must create an audit event and revision entry.

Potential future states such as `REJECTED` and `NEEDS_REVISION` are intentionally deferred until a real return-to-agent workflow is required.

---

## 7. Data Captured in a Daily Report

- Report date, assigned automatically by default
- Agent identity, taken from the authenticated account
- Total people
- Contacted count
- OK count
- Maybe count
- No count
- No-answer count
- Optional notes
- Status
- Submission timestamp
- Review timestamp
- Reviewer identity
- Creation and update timestamps
- Optimistic locking version

Derived values should not be stored when they can be calculated safely. For example:

```text
notContactedCount = totalPeople - contactedCount
```

---

## 8. Business and Validation Rules

### 8.1 Numeric rules

- No numeric value may be negative.
- `contactedCount` cannot exceed `totalPeople`.
- The sum of result categories must equal `contactedCount`.

```text
okCount + maybeCount + noCount + noAnswerCount = contactedCount
```

- One agent may have only one report per report date.
- Notes are optional and should have a reasonable maximum length.

### 8.2 Submission rules

- An invalid report may be saved as a draft.
- An invalid report cannot be submitted.
- Only the owning agent may submit their draft.
- Only a `DRAFT` report may be submitted through the normal workflow.
- Submission records `submittedAt` and changes the status to `SUBMITTED`.

### 8.3 Review rules

- Only a `SUBMITTED` report may be approved through the normal workflow.
- A correction reason is mandatory when any report value changes.
- Original and new values must be retained.
- Approval records the reviewer and review timestamp.
- Dashboard calculations for official totals use approved statuses only.

### 8.4 Concurrency rules

- Use optimistic locking to prevent silent overwrites.
- A stale update should return HTTP `409 Conflict` with a usable error response.

---

## 9. User Stories and Acceptance Criteria

## Epic A - Access and Identity

### US-01 - Sign in

**As a registered user, I want to sign in so that I can access the functions permitted for my role.**

Acceptance criteria:

- Given an active user with valid credentials, when the user signs in, then the system establishes a valid session and loads the correct home page.
- Invalid credentials produce a generic error that does not reveal whether the account exists.
- Inactive users cannot access the application.
- The backend validates the access token for every protected request.

### US-02 - Role-based access

**As an administrator, I want permissions enforced by role so that users cannot perform unauthorized operations.**

Acceptance criteria:

- Agents cannot access administrator endpoints.
- Managers cannot change reports.
- Supervisors can review and approve submitted reports.
- Unauthorized authenticated requests return `403 Forbidden`.
- Unauthenticated requests return `401 Unauthorized`.
- Frontend navigation reflects permissions, but backend enforcement remains authoritative.

## Epic B - Agent Reporting

### US-03 - Create a daily report

**As an agent, I want to record aggregated daily statistics so that my work is registered without a paper form.**

Acceptance criteria:

- The report date defaults to the current business date.
- Agent identity comes from the authenticated account.
- Numeric fields accept only valid whole numbers.
- A newly created report has status `DRAFT`.
- A duplicate report for the same agent and date is rejected.

### US-04 - See live calculations

**As an agent, I want totals and differences calculated while entering data so that I can correct mistakes before submission.**

Acceptance criteria:

- The UI displays the sum of outcome categories.
- The UI displays the calculated not-contacted count.
- Inconsistent numbers produce a clear warning.
- Submission is disabled while blocking validation errors exist.
- The same rules are revalidated by the backend.

### US-05 - Save a draft

**As an agent, I want to save incomplete work so that I can finish it later.**

Acceptance criteria:

- Incomplete or inconsistent values may be stored as a draft.
- The user sees when the draft was last saved.
- Saving does not change the report to `SUBMITTED`.

### US-06 - Edit a draft

**As an agent, I want to edit my own draft so that I can correct it before submission.**

Acceptance criteria:

- The owning agent can edit a `DRAFT` report.
- Another agent cannot view or edit it unless their role permits broader access.
- A submitted or approved report cannot be edited by an agent.

### US-07 - Submit a report

**As an agent, I want to submit a complete report so that a supervisor can review it.**

Acceptance criteria:

- Only a valid `DRAFT` can be submitted.
- Status becomes `SUBMITTED`.
- `submittedAt` is recorded.
- The report becomes read-only for the agent.
- The manager dashboard can include it immediately in provisional totals.

### US-08 - View personal report history

**As an agent, I want to view my previous reports and statuses so that I know whether they were approved.**

Acceptance criteria:

- Reports are sorted with the newest first.
- The agent can filter by date range and status.
- Each report clearly displays its status.
- The agent cannot see confidential supervisor-only information unless explicitly allowed.

## Epic C - Supervisor Review

### US-09 - View reports awaiting review

**As a supervisor, I want to see submitted reports so that I can process pending work efficiently.**

Acceptance criteria:

- The default list shows `SUBMITTED` reports.
- The list can be filtered by date and agent.
- The number of pending reports is visible.
- Results support pagination.

### US-10 - Review report details

**As a supervisor, I want to inspect a report and its calculations so that I can identify errors.**

Acceptance criteria:

- All submitted values and derived totals are visible.
- Validation warnings are displayed clearly.
- Agent, date, submission time, and notes are visible.
- Existing revisions are visible to authorized roles.

### US-11 - Correct a report

**As a supervisor, I want to correct inaccurate values with an explanation so that official statistics remain reliable.**

Acceptance criteria:

- The correction reason is mandatory.
- Changed fields record old and new values.
- The supervisor identity and timestamp are recorded.
- Corrected data must pass validation before final approval.
- The final status becomes `CORRECTED_AND_APPROVED` when correction and approval are completed together.

### US-12 - Approve a report

**As a supervisor, I want to approve a valid report so that it becomes part of official statistics.**

Acceptance criteria:

- Only a valid `SUBMITTED` report can be approved normally.
- Status becomes `APPROVED`.
- Reviewer and review timestamp are recorded.
- The report is included in approved dashboard totals.
- Repeated approval attempts are rejected safely.

### US-13 - View revision history

**As a supervisor, I want to see report changes so that I can understand how the final values were produced.**

Acceptance criteria:

- Each revision shows field, old value, new value, actor, time, and reason.
- Revision history is append-only for normal application users.
- Revision ordering is deterministic.

## Epic D - Management Dashboard

### US-14 - View provisional statistics

**As a manager, I want to see submitted data immediately so that I have a current operational overview.**

Acceptance criteria:

- Submitted reports are included in a clearly labeled provisional section.
- Provisional totals never appear as approved totals.
- The number of reports contributing to each total is visible.

### US-15 - View approved statistics

**As a manager, I want approved data shown separately so that official reporting remains trustworthy.**

Acceptance criteria:

- Only `APPROVED` and `CORRECTED_AND_APPROVED` reports contribute to official totals.
- Approved totals are labeled clearly.
- Corrected reports can be identified.

### US-16 - Filter dashboard data

**As a manager, I want to filter by date range and agent so that I can analyze a specific period or person.**

Acceptance criteria:

- Date range is required and validated.
- Agent filtering is optional.
- Filters apply consistently to cards, tables, charts, and exports.
- The active filter state is visible.

### US-17 - View performance by agent

**As a manager, I want a table of agent statistics so that I can compare operational results.**

Acceptance criteria:

- The table contains totals and key outcome counts.
- It can be sorted by permitted columns.
- Raw and approved contexts are not mixed.
- Empty states are handled clearly.

### US-18 - View trends

**As a manager, I want daily trend and outcome distribution charts so that I can identify changes over time.**

Acceptance criteria:

- A daily trend chart follows the active date filter.
- An outcome chart compares OK, Maybe, No, and No Answer.
- Chart information remains available in an accessible tabular form.

### US-19 - Export filtered data

**As a manager, I want to export filtered reports to CSV so that I can analyze or archive the information externally.**

Acceptance criteria:

- Export applies the same filters as the screen.
- Exported totals match dashboard data.
- The file uses UTF-8 encoding.
- Column headers are stable and documented.

## Epic E - Administration and Audit

### US-20 - Manage users

**As an administrator, I want to create, update, activate, and deactivate users so that system access remains current.**

Acceptance criteria:

- Required identity fields are validated.
- Email or external authentication subject is unique.
- Deactivated accounts cannot access protected features.
- User management actions are audited.

### US-21 - Assign roles

**As an administrator, I want to assign a role to each user so that access matches their responsibility.**

Acceptance criteria:

- Only supported roles can be assigned.
- Role changes take effect according to the authentication token refresh strategy.
- Role changes are audited.

### US-22 - View activity logs

**As an administrator, I want to inspect important actions so that system activity is traceable.**

Acceptance criteria:

- Logs include actor, action, entity, entity identifier, timestamp, and useful metadata.
- Sensitive secrets and tokens are never logged.
- Logs can be filtered by date, actor, action, and entity.

### US-23 - Override a locked report

**As an administrator, I want to correct a locked report in exceptional cases so that critical errors can be resolved without losing history.**

Acceptance criteria:

- An explicit reason is mandatory.
- All changed values are recorded as revisions.
- The activity is recorded in the audit log.
- The UI clearly warns that the operation is exceptional.

## Epic F - Internationalization

### US-24 - Change interface language

**As a user, I want to use the application in my preferred language so that the system is easier to understand.**

Acceptance criteria:

- English is available from the first release.
- All visible labels are stored in translation resources rather than hard-coded in components.
- Persian can be enabled without changing backend enum values or database records.
- The selected language is retained for future sessions.

### US-25 - Support RTL layout

**As a Persian-speaking user, I want a correct RTL interface so that the application feels natural to use.**

Acceptance criteria:

- The document direction changes to `rtl` for Persian and `ltr` for English.
- Navigation, forms, tables, icons, and spacing are reviewed in both directions.
- Dates and numbers are formatted through locale-aware APIs.
- Charts remain understandable in RTL mode.

---

## 10. Functional Requirements

### FR-01 Authentication integration
The system shall accept identity tokens from the selected authentication provider and establish a trusted application principal.

### FR-02 User profile mapping
The system shall map an external authentication identity to an internal user profile and application role.

### FR-03 Report creation
The system shall allow an agent to create one daily report per date.

### FR-04 Draft persistence
The system shall allow drafts that do not yet satisfy submission rules.

### FR-05 Validation
The system shall validate numeric relationships on both client and server.

### FR-06 Submission
The system shall transition valid drafts to `SUBMITTED` atomically.

### FR-07 Review
The system shall allow supervisors to retrieve and inspect submitted reports.

### FR-08 Correction
The system shall record report corrections without destroying original values.

### FR-09 Approval
The system shall approve reports atomically and record reviewer information.

### FR-10 Dashboard aggregation
The system shall calculate provisional and approved aggregates independently.

### FR-11 Filtering
The system shall filter report and dashboard data by date range, agent, and status where appropriate.

### FR-12 Export
The system shall produce a CSV export consistent with the active filters and dashboard calculations.

### FR-13 User administration
The system shall support user activation, deactivation, and role assignment.

### FR-14 Audit logging
The system shall record security-sensitive and business-critical actions.

### FR-15 Revision history
The system shall provide authorized access to an immutable chronological history of report changes.

### FR-16 Internationalization
The client shall load interface text from locale resources and support English and Persian.

### FR-17 Responsive UI
The client shall function on mobile, tablet, and desktop screens without installation.

---

## 11. Non-Functional Requirements

### 11.1 Usability

- The daily report should be completable in under one minute.
- Forms should minimize typing and use large, touch-friendly numeric controls.
- Error messages should explain how to resolve the problem.
- Destructive or exceptional actions require clear confirmation.

### 11.2 Performance

Initial MVP targets under normal load:

- Typical API reads: p95 below 500 ms, excluding network latency.
- Typical writes: p95 below 800 ms.
- Dashboard summary for a normal date range: p95 below 1.5 seconds.
- First meaningful client render on a normal broadband connection: target below 2.5 seconds.

These are engineering targets, not contractual service-level guarantees, and should be validated with measurements.

### 11.3 Reliability and data integrity

- Business state changes must be transactional.
- Database constraints shall reinforce application validation.
- Database migrations shall be version-controlled.
- Production backups and restore procedures shall be defined before real operational use.
- Dashboard and export calculations shall use the same shared query logic where practical.

### 11.4 Security

- All production traffic must use HTTPS.
- Access tokens must be validated for issuer, audience, expiry, signature, and required claims.
- Authorization must be enforced on the backend.
- Secrets must be stored outside source control.
- Sensitive values, credentials, and tokens must not be logged.
- Input must be validated and output encoded appropriately.
- CORS must allow only approved origins.
- Rate limiting should be introduced for sensitive endpoints before public exposure.

### 11.5 Privacy

- Collect only information required for the reporting workflow.
- Define data retention for reports and audit records.
- Avoid placing confidential information in free-text notes.
- Provide access to audit logs only to authorized roles.

### 11.6 Maintainability

- Use a modular monolith rather than microservices.
- Organize backend code by business feature.
- Keep controllers thin and business rules in services/domain components.
- Use automated formatting, linting, tests, and CI.
- Document public API endpoints with OpenAPI.

### 11.7 Accessibility

- Use semantic HTML and keyboard-accessible controls.
- Associate labels and validation messages with form fields.
- Do not use color as the only status indicator.
- Provide text or tabular equivalents for important chart data.
- Target WCAG 2.1 AA practices for the core workflow.

### 11.8 Compatibility

- Support the current and previous major versions of Chrome, Edge, Firefox, and Safari where practical.
- Support common mobile viewport sizes.

### 11.9 Observability

- Use structured application logs.
- Assign a correlation/request identifier.
- Expose health checks for deployment monitoring.
- Capture unexpected errors without exposing internal details to users.

---

## 12. Recommended Technology Stack

## 12.1 Frontend

- React 19
- TypeScript
- Vite
- React Router
- TanStack Query
- React Hook Form
- Zod
- Tailwind CSS
- shadcn/ui
- i18next and react-i18next
- Recharts
- Vitest and React Testing Library
- Playwright for critical end-to-end tests

### Frontend rationale

React and TypeScript provide a suitable balance of employability, maintainability, and learning value. Vite is sufficient because this is an authenticated dashboard application and does not require server-side rendering or SEO. TanStack Query handles server state, while React Hook Form and Zod keep form behavior explicit and testable.

## 12.2 Backend

- Java 21 LTS
- Spring Boot 3.5.x
- Spring Web
- Spring Security
- Spring Data JPA
- Hibernate
- Jakarta Bean Validation
- PostgreSQL
- Flyway
- MapStruct
- Springdoc OpenAPI
- JUnit 5
- Mockito
- Testcontainers
- Maven

Spring Boot 3.5 supports Java 21 and remains a stable choice for this project.

## 12.3 Database

**Recommended:** PostgreSQL hosted by Supabase initially, accessed by Spring Boot through the standard PostgreSQL JDBC driver.

The Java backend remains the owner of business writes and authorization decisions. The React client should not directly mutate reporting tables through Supabase APIs in the first architecture.

## 12.4 Authentication

**Recommended later integration:** Supabase Auth, with Spring Security configured as a JWT resource server.

Proposed flow:

```text
React signs in with Supabase Auth
        |
        v
React receives a short-lived access token
        |
        v
React calls Spring Boot with Authorization: Bearer <token>
        |
        v
Spring Security verifies the Supabase JWT through the project's JWKS endpoint
        |
        v
Spring maps token subject to the internal application user and role
```

Internal roles should be stored in the application database. Authentication proves identity; the application database determines business authorization.

## 12.5 Deployment

Suggested initial deployment:

- Frontend: Vercel, Netlify, or Cloudflare Pages
- Java API: Render, Railway, Fly.io, an application platform, or a small managed container service
- PostgreSQL and Auth: Supabase
- CI/CD: GitHub Actions

Supabase deploys database changes, storage configuration, and Edge Functions; it is not a general Java Spring Boot hosting platform. Therefore, the Spring Boot API must be deployed separately.

---

## 13. Supabase vs Firebase for This Architecture

| Criterion | Supabase | Firebase |
|---|---|---|
| Primary database model | PostgreSQL relational database | Firestore document database or Realtime Database |
| Fit for reporting and SQL aggregation | Excellent | Possible, but less natural for relational reporting |
| Authentication | Built-in JWT-based Auth | Mature Firebase Authentication |
| Java token verification | Standard JWT/JWKS integration | Excellent official Firebase Admin SDK support |
| Database portability | High, standard PostgreSQL | Lower if deeply coupled to Firestore |
| Local SQL and migrations | Strong | Different workflow from relational SQL |
| Hosting Java backend | No | Not directly through Firebase Hosting; use Google Cloud services |
| Best advantage here | One platform for PostgreSQL and Auth | Extremely mature auth tooling and Java Admin SDK |

### Recommendation

Use **Supabase PostgreSQL now** and defer authentication integration until the reporting workflow is stable. Later, use **Supabase Auth** unless authentication requirements become complex enough to justify a dedicated identity provider.

Firebase Authentication is technically strong and has an official Java Admin SDK for token verification. However, using Firebase Auth together with Supabase PostgreSQL creates two platform dependencies. Supabase Auth keeps identity and PostgreSQL in one operational platform and uses standard JWT verification.

### Important architecture boundary

Do not combine two independent authorization models accidentally.

- Supabase Auth or Firebase Auth proves who the user is.
- Spring Security verifies the token.
- The application database stores the user's business role.
- Spring services decide what the user may do.

---

## 14. Backend Architecture

Use a modular monolith.

```text
backend/
  src/main/java/com/example/callcenter/
    auth/
    user/
    report/
    dashboard/
    audit/
    export/
    common/
    config/
```

Feature package example:

```text
report/
  ReportController.java
  ReportService.java
  ReportRepository.java
  DailyReport.java
  ReportRevision.java
  ReportStatus.java
  dto/
  mapper/
  validation/
```

### Layer responsibilities

- Controller: HTTP translation, request validation, status codes.
- Service/domain: business rules, transactions, authorization decisions.
- Repository: persistence access.
- DTO: API contracts.
- Mapper: entity/DTO conversion.
- Configuration: security, CORS, OpenAPI, serialization.

Avoid exposing JPA entities directly through API responses.

---

## 15. Proposed Domain Model

### 15.1 User

- `id`
- `externalAuthSubject` (nullable until authentication integration)
- `fullName`
- `email`
- `role`
- `preferredLanguage`
- `active`
- `createdAt`
- `updatedAt`

### 15.2 DailyReport

- `id`
- `reportDate`
- `agentId`
- `totalPeople`
- `contactedCount`
- `okCount`
- `maybeCount`
- `noCount`
- `noAnswerCount`
- `notes`
- `status`
- `submittedAt`
- `reviewedAt`
- `reviewedBy`
- `version`
- `createdAt`
- `updatedAt`

Constraints:

- Unique `(agent_id, report_date)`
- Non-negative numeric fields
- Foreign keys for agent and reviewer

### 15.3 ReportRevision

- `id`
- `reportId`
- `changedBy`
- `fieldName`
- `oldValue`
- `newValue`
- `reason`
- `createdAt`

### 15.4 ActivityLog

- `id`
- `actorId`
- `action`
- `entityType`
- `entityId`
- `metadata` as JSONB
- `requestId`
- `createdAt`

---

## 16. Initial API Contract

Base path: `/api/v1`

### Development identity adapter

Authentication is deferred, but authorization design should not be removed. During early development, use a clearly isolated development-only identity adapter activated only by a local Spring profile.

Example development header:

```http
X-Dev-User-Id: <uuid>
```

This adapter must fail to start in production and must later be replaced by the JWT identity adapter.

### Reports

```http
POST   /api/v1/reports
GET    /api/v1/reports/my
GET    /api/v1/reports/my/today
GET    /api/v1/reports/{id}
PUT    /api/v1/reports/{id}
POST   /api/v1/reports/{id}/submit
```

### Supervisor

```http
GET    /api/v1/supervisor/reports
GET    /api/v1/supervisor/reports/{id}
POST   /api/v1/supervisor/reports/{id}/approve
POST   /api/v1/supervisor/reports/{id}/correct-and-approve
GET    /api/v1/supervisor/reports/{id}/revisions
```

### Dashboard

```http
GET /api/v1/dashboard/summary
GET /api/v1/dashboard/agents
GET /api/v1/dashboard/trends
```

Example query parameters:

```text
from=2026-07-01
to=2026-07-31
agentId=<uuid>
status=APPROVED
```

### Administration

```http
GET    /api/v1/admin/users
POST   /api/v1/admin/users
PATCH  /api/v1/admin/users/{id}
PATCH  /api/v1/admin/users/{id}/status
GET    /api/v1/admin/activity-logs
POST   /api/v1/admin/reports/{id}/override
```

### Export

```http
GET /api/v1/reports/export.csv
```

### Error response format

```json
{
  "timestamp": "2026-07-25T12:00:00Z",
  "status": 400,
  "code": "REPORT_TOTAL_MISMATCH",
  "message": "Outcome counts must equal contacted count.",
  "fieldErrors": {
    "contactedCount": "Expected 42 from the outcome totals."
  },
  "requestId": "..."
}
```

---

## 17. Multilingual Design

English is the initial interface language. Internationalization is implemented from the first frontend commit.

```text
src/locales/
  en/
    common.json
    auth.json
    reports.json
    dashboard.json
    validation.json
  fa/
    common.json
    auth.json
    reports.json
    dashboard.json
    validation.json
```

Rules:

- Do not hard-code visible UI strings in components.
- Keep backend enum and API values language-neutral.
- Translate status labels in the frontend.
- Set `document.documentElement.lang` and `dir` when the language changes.
- Use `Intl.DateTimeFormat` and `Intl.NumberFormat`.
- Test layout separately in LTR and RTL.
- Do not translate database identifiers or API property names.

---

## 18. Testing Strategy

### 18.1 Backend unit tests

- Validation rules
- State transitions
- Report submission
- Supervisor correction
- Approval
- Dashboard aggregation
- Authorization decisions

### 18.2 Backend integration tests

Use Testcontainers with PostgreSQL.

Critical scenarios:

- Agent creates a draft.
- Duplicate daily report is rejected.
- Invalid draft can be saved but not submitted.
- Agent cannot edit submitted report.
- Supervisor can approve submitted report.
- Manager cannot modify a report.
- Correction creates revisions.
- Administrator override creates revision and audit log.
- Dashboard raw and approved totals remain separate.

### 18.3 Frontend tests

- Form calculations
- Validation messages
- Disabled submission for invalid totals
- Query loading, error, and empty states
- Role-aware navigation
- Language switching
- RTL direction

### 18.4 End-to-end tests

Critical path:

```text
Agent creates and submits report
-> Supervisor reviews and approves
-> Manager sees approved statistics
```

---

## 19. Definition of Done

A story is done only when:

- Acceptance criteria are satisfied.
- Code is reviewed or self-reviewed against the checklist.
- Automated tests cover important behavior.
- Database migration is included when required.
- API documentation is updated.
- Error and empty states are handled.
- Authorization is enforced.
- User-visible text uses translation keys.
- No secrets or sensitive information are committed.
- CI passes.
- The feature is manually verified on mobile and desktop sizes.

---

## 20. Delivery Strategy: Backend First, but Contract-Driven

### Decision

Start with the backend, but do not build the entire backend before touching the frontend.

Use this sequence:

1. Define one use case and its API contract.
2. Implement its database migration and backend behavior.
3. Test the backend.
4. Build the matching minimal frontend workflow.
5. Validate the complete vertical slice.
6. Continue to the next use case.

### Why not pure frontend-first?

The difficult parts of this project are business rules, report states, authorization, audit history, transactions, and aggregation. A frontend-first approach risks producing attractive screens around an unstable domain model.

### Why not complete-backend-first?

Building every endpoint before using the API in a real interface can hide usability and contract problems for too long. Small vertical slices provide earlier feedback.

### Recommended order

- Backend foundation first
- Report domain and database second
- Agent report API third
- Minimal agent frontend fourth
- Supervisor backend and frontend next
- Dashboard backend and frontend after the workflow is trusted
- Authentication integration after the internal user and authorization model is stable

---

## 21. Phased Implementation Roadmap

## Phase 0 - Product and Repository Baseline

Deliverables:

- This specification committed to `/docs`.
- Glossary and status definitions.
- Initial ER diagram.
- Git repository and README.
- GitHub issue templates and project board.
- Architecture decision records for stack, auth deferral, and modular monolith.

Exit criteria:

- Scope and role boundaries are unambiguous.
- The repository builds an empty frontend and backend.

## Phase 1 - Backend Foundation

Deliverables:

- Spring Boot project with Java 21 and Maven.
- PostgreSQL local environment using Docker Compose or Supabase development database.
- Spring profiles for local, test, and production.
- Flyway baseline migration.
- Global error response format.
- OpenAPI configuration.
- Health endpoint.
- Structured logging and request IDs.
- Testcontainers setup.
- CI build and test workflow.

Authentication approach:

- No external authentication yet.
- Add a local-only development identity adapter.
- Design service methods around an `ActorContext` abstraction so JWT integration can replace the adapter later.

Exit criteria:

- Application starts locally.
- Migration runs automatically.
- Integration test connects to a disposable PostgreSQL container.
- Development identity cannot be enabled in production.

## Phase 2 - User and Report Domain

Deliverables:

- User, DailyReport, ReportRevision, and ActivityLog entities.
- Report status enum.
- Database constraints.
- Repositories.
- Validation component.
- Domain service for state transitions.
- Seed development users for each role.

Exit criteria:

- Domain rules have unit tests.
- Duplicate daily reports are prevented by application and database constraints.

## Phase 3 - Agent Reporting Vertical Slice

Backend:

- Create report.
- Save/update draft.
- Get today's report.
- List personal reports.
- Submit report.

Frontend:

- React/Vite/TypeScript setup.
- Internationalization setup with English resources.
- Minimal responsive layout.
- Daily report form.
- Live calculations and validation.
- Draft save and submission.
- Personal history page.

Exit criteria:

- A development agent can complete the full draft-to-submission workflow.
- The workflow is tested end-to-end.

## Phase 4 - Supervisor Review Vertical Slice

Backend:

- Pending-report query.
- Report review details.
- Approval transaction.
- Correction-and-approval transaction.
- Revision history.

Frontend:

- Pending reports list.
- Filters.
- Review screen.
- Correction reason dialog.
- Approval actions.
- Revision timeline.

Exit criteria:

- A submitted report can be approved or corrected and approved.
- Every correction is traceable.

## Phase 5 - Manager Dashboard

Backend:

- Shared filter model.
- Provisional summary query.
- Approved summary query.
- Agent performance query.
- Daily trend query.
- CSV export.

Frontend:

- Summary cards.
- Explicit raw/approved toggle or separate sections.
- Agent table.
- Trend and outcome charts.
- Filter controls.
- Export action.

Exit criteria:

- Dashboard and exported data match for the same filter.
- Raw and approved data are visually and logically distinct.

## Phase 6 - Administration and Audit

Deliverables:

- User management.
- Activation/deactivation.
- Role assignment.
- Activity log search.
- Administrator report override.
- Security-sensitive audit coverage.

Exit criteria:

- Every elevated mutation has a clear audit trail.

## Phase 7 - External Authentication

Recommended implementation:

- Configure Supabase Auth.
- Add sign-in UI.
- Configure Spring Security JWT verification against Supabase JWKS.
- Map JWT `sub` to `externalAuthSubject`.
- Remove or disable the development identity adapter outside local testing.
- Validate inactive-user and role-change behavior.

Exit criteria:

- Protected endpoints reject invalid or expired tokens.
- Application roles are loaded securely.
- Local development remains practical.

## Phase 8 - Persian and RTL

Deliverables:

- Persian translations.
- RTL layout behavior.
- Locale-aware dates and numbers.
- Persian font decision.
- Full mobile, desktop, LTR, and RTL review.

Exit criteria:

- No untranslated production labels.
- Critical screens work correctly in both directions.

## Phase 9 - Hardening and Deployment

Deliverables:

- Production Docker image.
- Frontend production build.
- Hosted Java API.
- Supabase production project.
- Environment secrets.
- Database backup plan.
- Error monitoring.
- Rate limiting for sensitive endpoints.
- Deployment documentation.
- Smoke tests after deployment.

Exit criteria:

- A clean environment can be deployed from documented steps.
- Health checks and critical workflow pass in production.

---

## 22. First Implementation Backlog

Recommended first tickets:

1. Create repository structure.
2. Generate Spring Boot Java 21 project.
3. Add Docker Compose PostgreSQL for local development.
4. Configure Flyway and create baseline migration.
5. Define standard API error response.
6. Add request correlation ID and health endpoint.
7. Configure Testcontainers.
8. Create `User` entity and development seed users.
9. Create `DailyReport` entity and constraints.
10. Implement report validation service and unit tests.
11. Implement development `ActorContext` adapter.
12. Implement create-draft endpoint and integration test.
13. Generate React TypeScript Vite project.
14. Configure i18next with English resources.
15. Build the create-report page against the real endpoint.

The first meaningful milestone is not “backend complete.” It is:

> A development agent can create a report draft through the React interface, and the report is validated and stored by the Spring Boot API in PostgreSQL.

---

## 23. Main Risks and Mitigations

### Risk: Authentication choice drives application design too early
Mitigation: use an internal `ActorContext` abstraction and integrate the provider after the domain workflow is stable.

### Risk: Direct React-to-Supabase data access bypasses Java business rules
Mitigation: route reporting operations through Spring Boot; use Supabase primarily as PostgreSQL and Auth infrastructure.

### Risk: Raw and approved totals become inconsistent
Mitigation: centralize aggregation logic, test status filters, and use the same filter model for dashboard and export.

### Risk: Corrections destroy original values
Mitigation: perform correction and revision insertion in one transaction; make revisions append-only.

### Risk: RTL is added too late
Mitigation: externalize all strings and use direction-aware layout from the initial frontend setup, while postponing translation content.

### Risk: Overengineering
Mitigation: modular monolith, one database, REST, no messaging platform, no microservices, and no premature generic permission engine.

---

## 24. Final Architectural Decision

Use the following baseline:

```text
Frontend:
React 19 + TypeScript + Vite
TanStack Query
React Hook Form + Zod
Tailwind CSS + shadcn/ui
i18next
Recharts

Backend:
Java 21
Spring Boot 3.5.x
Spring Web
Spring Security
Spring Data JPA
Bean Validation
Flyway
JUnit + Mockito + Testcontainers

Infrastructure:
Supabase PostgreSQL
Supabase Auth, integrated later
Separate Java API hosting
GitHub Actions

Architecture:
Modular monolith
REST API
Backend-owned business rules
External authentication + internal authorization
English-first multilingual UI
Backend-first, contract-driven vertical slices
```

---

## 25. Official Technical References

- Spring Boot 3.5 system requirements: https://docs.spring.io/spring-boot/3.5/system-requirements.html
- Supabase Auth overview: https://supabase.com/docs/guides/auth
- Supabase JWT guide and JWKS verification: https://supabase.com/docs/guides/auth/jwts
- Supabase deployment scope: https://supabase.com/docs/guides/deployment
- Firebase ID token verification for custom backends: https://firebase.google.com/docs/auth/admin/verify-id-tokens

---

## 26. Document Change Policy

This file is the initial project baseline. Future changes should be made through small, explicit updates and recorded in architecture decision records when they affect stack, security, domain rules, or deployment.
