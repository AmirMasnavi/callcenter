# Project Memory

*Last updated: 2026-07-25*

## Current status

- Project structure and foundational documentation were created from the initial product specification.
- No production application features are implemented yet.
- The former root-level Maven baseline was relocated to `services/api/`; it remains a minimal placeholder, not a Spring Boot application.
- The relocated API baseline passed `mvn -f services/api/pom.xml test` on 2026-07-25.
- The next planned implementation phase is API foundation: Spring Boot, PostgreSQL local environment, Flyway, standard errors, OpenAPI, health checks, structured logs/request IDs, and Testcontainers.

## Architecture decisions

- Use a modular monolith: React client + Spring Boot API + PostgreSQL.
- Keep reporting writes and authorization decisions in Spring Boot; React must not directly mutate reporting tables.
- Use Supabase PostgreSQL initially; defer Supabase Auth/JWT integration until internal users and authorization are stable.
- During local development only, use an isolated development identity adapter behind `X-Dev-User-Id`. It must be disabled outside local/test profiles.
- Deliver functionality in backend-first, contract-driven vertical slices rather than frontend-first or complete-backend-first phases.
- English is the initial UI language. Translation keys and direction-aware UI are required from the first frontend commit; Persian RTL is a later delivery phase.

## Known open questions

- Authentication provider and Supabase project configuration have not been selected/configured.
- Local PostgreSQL orchestration (Docker Compose versus another development workflow) is not yet implemented.
- Production hosting and backup/retention policies are not yet decided.

## Changelog notes

- 2026-07-25: Established `apps`, `services`, `packages`, `infrastructure`, and documentation structure. Added project operating instructions, development guide, architecture/domain/API notes, and two initial ADRs.
