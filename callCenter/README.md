# Call Center Reporting System

A mobile-first web application for end-of-day, aggregated call-center reporting. Agents create daily reports, supervisors review and approve them, managers view clearly separated provisional and official statistics, and administrators manage access and audit history.

The product is a modular monolith: a React web client, a Java Spring Boot API, and PostgreSQL. It deliberately does **not** record individual calls or provide CRM, telephony, or AI analytics capabilities.

## Project layout

```text
apps/web/                 React + TypeScript client (to be initialized in Phase 3)
services/api/             Spring Boot modular-monolith API
packages/api-contract/    Shared API-contract artifacts when introduced
infrastructure/           Local environment and deployment assets
docs/                     Product, engineering, architecture, and operational documentation
```

Read [the development guide](docs/development-guide.md) before making changes. The complete baseline product specification is in [docs/description](docs/description/Call_Center_Reporting_System_Project_Specification.md).

## Current state

Repository structure and project documentation are in place. Application and frontend scaffolding remain intentionally unimplemented; Phase 1 begins with the API foundation.
