# RECAP

## Task
Count clips grouped by exact category value and print each category name with its count, plus the total across all clips.

## What was done
Queried the `clips` table directly and grouped by the exact `category` column value. Checked for hidden clips separately — there are none (0 of 546 rows have `hidden = true`), so the full-table count and the visible-only count are identical.

## Result

| Category | Count |
|---|---|
| Bottom Game | 241 |
| Top Game | 176 |
| Standup | 61 |
| Guard Pass | 45 |
| Leg Game | 22 |
| Uncategorized | 1 |
| **Total** | **546** |

The single remaining "Uncategorized" clip is "openmat" (per the prior categorization work).
