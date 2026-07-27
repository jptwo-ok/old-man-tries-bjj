# RECAP

## Task
Update category for two clips, matched by exact title (case-insensitive), verifying the row exists before updating:
- "pass deep half" → "Top Game"
- "stack pass counter" → "Bottom Game"

If either title isn't found, report clearly rather than guessing at a similar title.

## What was done
- Searched all clips for a case-insensitive exact match on each title.
- **"pass deep half"** — found exactly one match, `id=c2f20a1d-7ceb-400f-9a47-41a9353cfaef`. Category updated: `Guard Pass` → `Top Game`.
- **"stack pass counter"** — found exactly one match, `id=1af14f70-5723-4501-8adf-cac6a293edc0`. Category updated: `Guard Pass` → `Bottom Game`.

## Result
Both titles were found unambiguously (single match each) and both updates succeeded. No "not found" or ambiguous-match case applied.
