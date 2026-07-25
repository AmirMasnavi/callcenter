# ADR-001: Use a modular monolith

**Status:** Accepted (initial baseline)

## Decision

Build one Spring Boot API with feature-oriented modules and one PostgreSQL database. Keep a separate React client.

## Rationale

The MVP needs reliable transactions, authorization, revisions, and aggregates, not independently deployable services. A modular monolith provides clear boundaries without distributed-system complexity.

## Consequences

Avoid microservices, event streaming, and generic permission engines unless a validated future requirement makes their cost worthwhile.
