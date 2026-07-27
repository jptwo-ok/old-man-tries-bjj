# RECAP

## Task
Fix live re-sorting after a vote, in [components/VotePanel.jsx](components/VotePanel.jsx) and [components/ClipGrid.jsx](components/ClipGrid.jsx). VotePanel maintained its own local vote counts for the fade animation, but ClipGrid's `voteCounts` prop (used for sorting) was fetched once at page load and never updated after a vote, so tiles never reordered without a full page reload.

Required fix:
1. Add an `onVoteChange` callback prop to VotePanel, called with `(clipId, voteType, prevVote)` when `castVote` succeeds.
2. Lift `voteCounts` into local state in ClipGrid (seeded from the `voteCounts` prop), and pass an `onVoteChange` handler down through `renderClipTile` to each VotePanel instance that updates this state the same way VotePanel's own optimistic update does.

## What was done
- [components/VotePanel.jsx](components/VotePanel.jsx#L7): added `onVoteChange` prop. In `castVote`, after the Supabase `upsert` resolves without an `error`, calls `onVoteChange(clipId, voteType, prevVote)` (in the `else` branch alongside the existing error-rollback branch, so it never fires on a failed write).
- [components/ClipGrid.jsx](components/ClipGrid.jsx#L153): renamed the incoming prop to `initialVoteCounts` and lifted it into `voteCounts` local state via `useState`, matching the existing `clips` pattern. Added `handleVoteChange(clipId, voteType, prevVote)`, which mirrors VotePanel's own optimistic-update math (decrement `prevVote`, increment `voteType`) against the local `voteCounts` state.
- Threaded `onVoteChange: handleVoteChange` through all three `renderClipTile(...)` call sites (search results, Featured section, category sections), through `renderClipTile` → `ClipTile` → the `<VotePanel>` instance rendered when a tile is expanded.
- Because `sortClipsForCategorySection`, `sortFeaturedClips`, and `sortClipsForDisplay` already depend on `voteCounts` in their `useMemo` dependency arrays, updating this state now automatically re-triggers those memos, so a tile visibly moves to its new tier/position the instant a vote succeeds — no reload needed.
- Left the standalone clip page ([app/clip/[id]/page.js](app/clip/[id]/page.js)) untouched — it renders VotePanel without `onVoteChange`, which is optional and simply skips the callback there.

Ran `npm run build` — compiled successfully, all 19 routes generated with no errors.

## Result
Committed as `f595862` ("fix: re-sort clips live after a vote instead of requiring reload") and pushed to `origin/main`.
