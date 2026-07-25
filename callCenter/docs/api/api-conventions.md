# API Conventions

## Baseline

- Base path: `/api/v1`.
- Use JSON request/response bodies except CSV export endpoints.
- Validate protected requests in the backend; return `401` for unauthenticated and `403` for unauthorized requests.
- Pagination, filtering, sorting, and date-range validation must be documented with each list endpoint.

## Errors

Use a stable error shape:

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

Return `409 Conflict` for an optimistic-locking/stale-write conflict and give the caller a useful next action. Do not expose internal exception details.

## Contracts

The initial endpoint inventory and role expectations are defined in the project specification. Update the generated OpenAPI document whenever implementing or changing a public endpoint.
