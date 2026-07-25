# ADR-002: Defer external authentication integration

**Status:** Accepted (initial baseline)

## Decision

Use a local-only development identity adapter during initial reporting development. Integrate Supabase Auth JWT validation later, through an `ActorContext` abstraction.

## Rationale

The highest-risk early work is report workflow, validation, audit history, and authorization rules. Deferral prevents provider configuration from distorting those boundaries.

## Consequences

The development identity adapter must fail outside allowed local/test profiles. The application database remains the source of roles and active-user status.
