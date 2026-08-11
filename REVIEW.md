## REVIEW

**Part 1 (`components/ClipGrid.jsx`)** is unchanged from the plan reviewed in the previous round and still checks out exactly as before — the current `groupedSections` implementation matches what's described, `sortedClips`/the search branch really are built independently from `searchedClips` (not from `groupedSections`), and `featuredSection` is untouched. No new issues found there.

**Part 2 (`app/clip/[id]/page.js`'s `getNeighbors`) introduces a real bug as written, not just an edge case.** `getNeighbors(currentId)` needs to find `currentId`'s own position in `ordered` in order to compute its neighbors. If the clip currently being viewed is itself Featured, filtering it out of the base list *before* flattening means it is never present in `ordered` at all — `ordered.findIndex(c => c.id === currentId)` returns `-1`, and the function falls into its existing `if (index === -1) return { prevId: null, nextId: null };` branch.

Concretely: visiting a Featured clip's own detail page directly would silently lose *all* swipe/arrow-key/chevron navigation, every time. This isn't a crash — the `-1` branch is already handled gracefully, and `ClipSwipeNav.jsx` already no-ops/hides its chevrons when `prevId`/`nextId` are `null` — but it is a real, unstated behavior change well beyond "don't duplicate the clip." It means a Featured clip loses swipe access to its own neighbors entirely, which the plan's stated goal doesn't actually call for (the goal is that *other* clips shouldn't route *into* a Featured clip via its old category position — not that the Featured clip itself should lose its own navigation).

Useful precedent worth noting: this exact `-1`-returns-`null`s pattern is already what happens today for a **hidden** clip's detail page — `getClip` fetches a clip by id with no `hidden` filter, but `getNeighbors`'s own `clips` query explicitly filters `.eq("hidden", false)`, so a hidden clip is already never present in `ordered` today, and its detail page already has no swipe neighbors. So there's real precedent in this exact function for "this clip isn't part of the flow, so it gets no neighbors" — which arguably makes the Featured-clip case defensible as intentional (a Featured clip has "graduated" out of its category's flow, so no longer having prev/next within that flow is consistent). But it should be a conscious, confirmed decision, not a side effect that falls out of copying Part 1's filter verbatim into Part 2.

One more confirmation: **Part 1 has no equivalent problem.** On the grid, a Featured clip's expanded-tile swipe/chevron nav is scoped to whichever list was passed as its `clipList` prop — when rendered from within the Featured section, that's `featuredSection`, not `groupedSections` — so a Featured clip stays fully swipeable among other Featured clips there. Only `getNeighbors`'s single flattened list (used for the whole detail-page swipe experience, with no per-section context) has the self-exclusion problem.

## SIMPLER APPROACH?

Not simpler overall, but Part 2's fix needs to differ from a literal copy of Part 1's filter. Two ways to resolve the self-exclusion problem:

1. **Accept it as the intended outcome**: a Featured clip has no prev/next swipe neighbors on its own detail page, consistent with the existing hidden-clip precedent in this same function. This is what the plan's code as written already produces — simplest to implement, but it's a real behavior change that should be stated and confirmed explicitly, not left implicit.
2. **Preserve the current clip's own lookup regardless of its featured status** (only exclude *other* featured clips from appearing as someone else's neighbor). More code, and more ambiguity about what a featured clip's "neighbors" should even mean once it's conceptually out of the category flow — likely not worth the complexity unless swipe-from-a-featured-clip's-own-page is something you actually want preserved.

Recommendation: option 1, given the direct precedent already in this function, but call it out explicitly in the plan rather than let it happen implicitly.

## READY TO IMPLEMENT?

Part 1: Yes, as previously reviewed — no changes needed.

Part 2: No — confirm whether losing swipe navigation entirely on a Featured clip's own detail page is the intended behavior (recommended, given the hidden-clip precedent) before implementing Part 2 as written.
