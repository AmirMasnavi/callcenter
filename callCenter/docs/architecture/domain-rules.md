# Domain Rules

## Report lifecycle

```text
DRAFT -> SUBMITTED -> APPROVED
                    -> CORRECTED_AND_APPROVED
```

- Only the owning agent may normally edit or submit a draft.
- An invalid report can be saved as `DRAFT` but cannot be submitted.
- Only a submitted report can normally be approved.
- Corrections require a reason and create revisions in the same transaction as the final state change.
- Approved states are locked for normal users. Administrator overrides require an explicit reason, revision entries, and an audit event.

## Validation

- All captured numeric values are non-negative whole numbers.
- Contacted count cannot exceed total people.
- Outcome categories must total contacted count: `ok + maybe + no + noAnswer = contacted`.
- `notContacted = totalPeople - contactedCount` is derived on demand.
- One agent has one report for a report date.

## Aggregation contexts

| Context | Included statuses |
| --- | --- |
| Provisional | Submitted reports, clearly labeled as provisional |
| Official | `APPROVED`, `CORRECTED_AND_APPROVED` only |

Do not mix these contexts. The same filter interpretation must be reused for dashboard and CSV exports.
