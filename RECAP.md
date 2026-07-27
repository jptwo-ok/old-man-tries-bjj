# RECAP

## Task
In [components/ClipGrid.jsx](components/ClipGrid.jsx), update `sortClipsForCategorySection` to use three tiers instead of two:
1. Tier 1 (top) — positive net score (UP*2 - DOWN*1 > 0), sorted by score descending, newest as tiebreak.
2. Tier 2 (middle) — no votes at all, sorted by `extractPrimaryKeyword` alphabetically, newest first within the same keyword (existing logic, unchanged).
3. Tier 3 (bottom) — net score 0 or negative but at least one vote (DOWN > 0), sorted by score ascending (worst at the very bottom), newest as tiebreak.

`sortClipsForDisplay` (flat search view) and vote counting/storage were left untouched — only the category-section sort order changed.

## What was done
Rewrote `sortClipsForCategorySection` in [components/ClipGrid.jsx](components/ClipGrid.jsx#L106-L149) to bucket each clip into one of three tiers based on vote counts and net score, sort each tier independently, and concatenate them in order (tier 1, tier 2, tier 3). Previously downvoted clips with a non-positive score fell into the same "everything else" bucket as unrated clips and were sorted alphabetically alongside them; now they form their own bottom tier sorted by ascending score, so a heavily downvoted clip sinks below the unrated middle tier instead of being interleaved with it.

Ran `npm run build` — compiled successfully, all 19 routes generated with no errors.

## Result
Committed as `3355fce` ("feat: split category section sort into three vote-score tiers") and pushed to `origin/main`.
