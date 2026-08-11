# RECAP

## Task
Migrate all Supabase-hosted clip thumbnails to Cloudflare R2, to eliminate the Supabase Storage egress identified in this morning's investigation (545/546 thumbnails were being served from Supabase with a `Cache-Control: no-cache` header). Only `thumbnail_url` was to be touched — `video_url` and every other clip field, and the original Supabase Storage files themselves, were to be left untouched.

## What was done
Wrote [scripts/migrate-thumbnails-to-r2.js](scripts/migrate-thumbnails-to-r2.js). For every clip whose `thumbnail_url` matched `%supabase.co%`, it:
1. Downloaded the image bytes from the existing Supabase `thumbnail_url`.
2. Uploaded them to R2 (via a directly-constructed `S3Client`, mirroring `lib/r2Client.js`'s config — that file uses ESM `export` syntax and can't be `require()`'d from a plain CommonJS script) under key `thumbs/{clip.id}.jpg`, `Content-Type: image/jpeg`.
3. Updated only that clip's `thumbnail_url` in Supabase to `https://cdn.oldmantriesbjj.com/thumbs/{clip.id}.jpg`.
4. Left the original Supabase Storage file in place — no deletions were performed.

Each clip's download/upload/update ran in its own try/catch (10-way concurrency) so a single failure couldn't stop the batch.

**Test batch (5 clips, `--limit=5`):** All 5 succeeded. Verified each new R2 URL with a follow-up HEAD request — all returned HTTP 200, `Content-Type: image/jpeg`, and a `content-length` matching the uploaded byte count.

**Full run (remaining 540 clips):** Launched only after the test batch was confirmed clean. Logged progress every 25 clips.

## Results (step 6)
- **Total processed: 545** (5 test + 540 full run)
- **Total succeeded: 545**
- **Total failed: 0** — no failed clip ids/titles to report
- **Fresh count of clips still with a Supabase-hosted `thumbnail_url`: 0** (confirmed via a live count query after the run, `ilike thumbnail_url '%supabase.co%'`)
- **Fresh count of clips with an R2-hosted `thumbnail_url`: 546 / 546** (i.e. all clips, confirmed via `ilike thumbnail_url '%cdn.oldmantriesbjj.com%'`)

`video_url` was not read or modified by the script at any point; no other clip fields were touched. Original Supabase Storage objects were left in place, untouched.

## Bottom line
All 545 previously-Supabase-hosted thumbnails are now served from `cdn.oldmantriesbjj.com` (R2). 0 clips remain pointing at Supabase Storage for thumbnails, and 0 migrations failed. The script (`scripts/migrate-thumbnails-to-r2.js`) is idempotent and safe to re-run if needed — it always re-queries for whatever still matches `%supabase.co%`, so it would simply find nothing to do on a re-run right now.

---

# RECAP 2 — 2026-08-10

## Task
Fix "back to grid" losing scroll position and search state when navigating from the clip detail page back to the homepage grid, across [app/clip/[id]/page.js](app/clip/[id]/page.js) and [components/ClipGrid.jsx](components/ClipGrid.jsx).

## What was done
**Search state moved into the URL** ([components/ClipGrid.jsx](components/ClipGrid.jsx)): the search box's text is now read from and synced to a `?q=` query parameter via `useSearchParams`/`useRouter`/`usePathname` (`next/navigation`), instead of living only in local `useState`. Typing in the box calls `router.replace(...)` with `{ scroll: false }` so it updates the URL without jumping the page. Because the homepage (`app/page.js`) already sets `export const dynamic = "force-dynamic"`, no `<Suspense>` boundary was needed around `useSearchParams`.

**Native autocomplete dropdown removed** ([components/ClipGrid.jsx](components/ClipGrid.jsx)): dropped the `list="clip-word-list"` attribute on the search `<input>`, the `<datalist id="clip-word-list">` block, and the `wordList` `useMemo` that fed it — the browser no longer shows its own suggestion popup over the search box.

**"Back to grid" link now preserves scroll position** ([components/BackToGridLink.jsx](components/BackToGridLink.jsx), new file): added a small client component that calls `router.back()` on click instead of rendering a plain `<Link href="/">`, so returning to the grid restores the browser's scroll position (and, combined with the URL-synced search above, the active search) instead of landing on a fresh top-of-page load. [app/clip/[id]/page.js](app/clip/[id]/page.js) now renders `<BackToGridLink />` in place of the old `Link`, with the visible text changed from "← back to grid" to just "back" (same `font-mono text-xs opacity-70 hover:opacity-100` styling).

Left untouched: `excludedSet`/`excludedWords` in ClipGrid — its only prior consumer was the removed `wordList`, but the task scope named only `wordList` for removal, so it was kept as-is rather than pulling on that thread further.

## Verification
`npm run build` passed cleanly: `✓ Compiled successfully`, all 18 routes generated with no errors or warnings.

## Bottom line
Search text now lives in the URL (`?q=`) rather than component-local state, the browser's native autocomplete dropdown on the search box is gone, and the clip detail page's back link uses `router.back()` (and reads "back") so scroll position and search state both survive a round trip to a clip and back. Build verified green; changes committed and pushed to `main` (commit `6e0d6d7`).

---

# RECAP 3 — 2026-08-10

## Task
Two changes across [components/ClipGrid.jsx](components/ClipGrid.jsx) and [app/clip/[id]/page.js](app/clip/[id]/page.js): (1) restructure the homepage's "Jump to" nav to bring back the Standup link and wrap on narrow screens instead of scrolling sideways, and (2) add left/right swipe navigation between clips, both on an expanded grid tile and on the standalone clip detail page.

## What was done

**Part 1 — "Jump to" nav restructure** ([components/ClipGrid.jsx](components/ClipGrid.jsx)): "Standup" is back as the first jump link (order: Standup, Guard Pass, Top Game, Bottom Game, Leg Game) — it had been dropped earlier when Standup was the first section on the page, but the Featured section can now render above it, so `#top` no longer lands on Standup. The "Jump to:" label now sits on its own row, with the links below it in a `flex flex-wrap` container instead of the old `whitespace-nowrap overflow-x-auto` row, so they wrap naturally on a narrow phone instead of needing a sideways scroll. The search icon button moved to sit next to the "Jump to:" label on that first row, out of the way of the wrapping links.

**Part 2 — swipe navigation between clips**, added purely on top of existing tap/long-press behavior (all unchanged):

- *Expanded grid tile* ([components/ClipGrid.jsx](components/ClipGrid.jsx)): each `renderClipTile` call site now also passes `clipList` — the exact ordered array already being `.map()`-ed for that section (search results, the Featured section, or a given category section's sorted clips) — down into `ClipTile`. The tile's existing `handleTouchEnd` already distinguished "moved" (scroll) from "not moved" (tap); it now also checks, only when `isExpanded` and the finger moved, whether the release was a horizontal swipe of at least 50px and more horizontal than vertical. If so it looks up the current clip's neighbor in `clipList` and calls `setExpandedId(neighbor.id)` — keeping the tile expanded and switching to the adjacent clip. At either end of the list (no neighbor) swiping does nothing; no wraparound.
- *Clip detail page* ([app/clip/[id]/page.js](app/clip/[id]/page.js)): added `getNeighbors()`, which fetches all non-hidden clips and all votes, builds the same `voteCounts` shape the homepage uses, and reuses `groupClipsByCategory` + `sortClipsForCategorySection` (both extracted to the new [lib/clipSort.js](lib/clipSort.js), see below) to flatten clips into the identical category-grouped, three-tier-sorted order as the homepage's default view. It finds the current clip's index in that order and returns `prevId`/`nextId` (either `null` at an end, or if the current clip isn't in the non-hidden list). The page now renders its content inside a new [components/ClipSwipeNav.jsx](components/ClipSwipeNav.jsx) client component, which detects the same left/right swipe (≥50px, horizontal-dominant) and calls `router.push` to `/clip/{nextId}` or `/clip/{prevId}` — a client-side navigation, not a full reload. No wraparound past either end.

**Shared sort logic extracted** ([lib/clipSort.js](lib/clipSort.js), new file): `CATEGORY_ORDER`, `UNCATEGORIZED`, `STOPWORDS`, `extractPrimaryKeyword`, `sortClipsForCategorySection`, and `groupClipsByCategory` moved out of `ClipGrid.jsx` into this shared module — this was necessary so the server-rendered detail page could compute the identical ordering without duplicating (and risking drift from) the homepage's sort logic. `ClipGrid.jsx` now imports them from there instead of defining them locally; `categoryToId` and the featured-only `sortFeaturedClips`/`sortClipsForDisplay` stayed in `ClipGrid.jsx` since only it needs them.

## Verification
`npm run build` passed cleanly: `✓ Compiled successfully`, all 18 routes generated, no errors. Also smoke-tested with `npm run dev`: homepage returned HTTP 200, and a real clip detail page (`/clip/8100ceb8-...`) returned HTTP 200 and rendered the "back" link as expected.

## Bottom line
The "Jump to" nav now includes Standup again and wraps cleanly on narrow phones instead of scrolling sideways. Swiping left/right now moves between clips both on an expanded grid tile (staying expanded, same section order, no wraparound) and on the standalone clip page (client-side navigation via the homepage's own category-sorted order, no wraparound). Build verified green; changes committed and pushed to `main` (commit `0f71b2f`).

---

# RECAP 4 — 2026-08-10

## Task
Two changes: (1) filter bot/crawler traffic out of `page_views` tracking on the homepage and clip detail page, and (2) add desktop-only keyboard-arrow and click-chevron navigation between clips — matching the existing mobile swipe behavior — on both the expanded grid tile and the standalone clip detail page.

## What was done

**Part 1 — bot detection** ([lib/isBot.js](lib/isBot.js), new file): exports `isBot(userAgent)`, which tests the UA against a single case-insensitive regex covering the requested bot/crawler/link-preview signatures (search engine bots, social-platform link unfurlers like `facebookexternalhit`/`slackbot`/`discordbot`/`whatsapp`/`telegrambot`/`twitterbot`/`linkedinbot`/`embedly`/`quora link preview`/`pinterest`/`vkshare`, validators/monitors like `w3c_validator`/`uptimerobot`/`pingdom`, SEO crawlers like `ahrefsbot`/`semrushbot`/`mj12bot`/`dotbot`/`petalbot`/`bytespider`, and headless browsers `headlesschrome`/`phantomjs`), plus a generic `bot|crawler|spider` catch-all. A missing/empty user-agent also returns `true`, since real browsers always send one.

**Parts 2 & 3 — applied in both page-view sites**: [app/page.js](app/page.js) and [app/clip/[id]/page.js](app/clip/[id]/page.js) now read the request's user-agent via `headers().get("user-agent")` (`next/headers`) and only run their existing `page_views` insert when `!isBot(userAgent)`. Nothing else about either insert changed.

**Part 4 — desktop nav on the clip detail page** ([components/ClipSwipeNav.jsx](components/ClipSwipeNav.jsx)): added a `useEffect` that attaches a `window` `keydown` listener — `ArrowRight` calls `router.push` to `nextId` (if set), `ArrowLeft` to `prevId` (if set) — plus two `fixed`, vertically-centered chevron buttons (left/right edges of the viewport, `hidden md:flex` so they never show on mobile) that call the same navigation on click. Each button only renders when its corresponding `prevId`/`nextId` exists, so there's nothing to click at either end of the list. The existing touch-swipe `handleTouchStart`/`handleTouchEnd` logic was not touched.

**Part 5 — desktop nav on expanded grid tiles** ([components/ClipGrid.jsx](components/ClipGrid.jsx)): added a new `goToNeighbor(direction)` helper inside `ClipTile` that performs the same `clipList` index lookup the touch-swipe handler already does inline, then a `keydown`-listening `useEffect` (active only while `isExpanded`) that calls it for `ArrowRight`/`ArrowLeft`, plus two `hidden md:flex` chevron buttons absolutely positioned on the tile's left/right edges (styled and gated — `stopPropagation`/`preventDefault` — the same way the existing open-clip-page and unmute buttons are) that call `goToNeighbor` on click and only render when a `prevClip`/`nextClip` exists. The existing `handleTouchStart`/`handleTouchMove`/`handleTouchEnd` swipe block was left byte-for-byte unchanged — `goToNeighbor` is new code that duplicates its lookup rather than refactoring it, per the requirement to keep existing touch/swipe logic completely untouched.

## Verification
`npm run build` passed cleanly: all 18 routes generated, no errors. Smoke-tested with `npm run dev`: homepage and a real clip detail page both returned HTTP 200. Bot filtering was verified end-to-end against the live Supabase `page_views` table (not just code review) — starting count 11090: a request with a Googlebot user-agent left the count at 11090 (insert skipped), then a request with a normal Chrome user-agent bumped it to 11091 (insert ran normally).

## Note on existing data
Bot filtering only affects page views recorded **going forward** — it does not retroactively clean up or backfill the `page_views` rows already in the table from before this change, some of which are presumably bot traffic recorded under the old unfiltered logic.

## Bottom line
`page_views` inserts on both the homepage and clip detail page now skip known bots/crawlers/link-previews (or missing UAs) via a shared `lib/isBot.js`, verified live against Supabase. Desktop users can now also navigate between clips with the left/right arrow keys or by clicking edge chevrons, on both an expanded grid tile and the standalone clip page — mirroring the existing mobile swipe gesture exactly, with no wraparound past either end and zero changes to the existing touch-swipe code in either file. Build verified green; changes committed and pushed to `main` (commit `2e81a5f`).

---

# RECAP 5 — 2026-08-10

## Task
Change bot/crawler handling in `page_views` from dropping the row entirely to tagging it (the table already has an `is_bot` boolean column, added directly in Supabase), surface both the raw and bot-filtered totals on the admin dashboard, and (re-)add desktop-only keyboard/click navigation between clips — mobile touch swipe must stay completely unchanged.

## What was done

**Parts 1, 5, 6 — already in place from prior work**: before touching anything, I re-read [lib/isBot.js](lib/isBot.js), [components/ClipSwipeNav.jsx](components/ClipSwipeNav.jsx), and [components/ClipGrid.jsx](components/ClipGrid.jsx) and confirmed all three already matched this task's spec exactly — the single-regex `isBot()` helper, the `ClipSwipeNav` keydown listener + `hidden md:flex` chevrons calling `router.push`, and `ClipGrid`'s `goToNeighbor()` helper + keydown listener + chevrons calling `setExpandedId`, all from the previous session's work. No changes were needed or made to any of these three files or to the existing touch/swipe handlers in either component.

**Verified the `is_bot` column** exists in Supabase (`page_views.is_bot`, boolean, default `false`) before wiring code to it, rather than assuming — confirmed via a direct query returning sample rows and matching total/`is_bot=false` counts.

**Part 2 & 3 — tag instead of drop** ([app/page.js](app/page.js), [app/clip/[id]/page.js](app/clip/[id]/page.js)): replaced the previous `if (!isBot(userAgent)) { insert }` (which skipped the row for bots) with an unconditional insert that always runs, now including `is_bot: isBot(userAgent)` in the inserted row. Every request is recorded again; only the flag differs.

**Part 4 — dashboard split** ([app/admin/(protected)/page.js](app/admin/(protected)/page.js)): added a `realViews` query (`page_views` count where `is_bot = false`) alongside the existing unfiltered `totalViews` count, and added a third stat card, "real visitors (bot-filtered)", into what was a 2-column grid (now 3 columns) next to the existing "total page views" card — same `border border-line rounded-md p-4 text-center` / `text-2xl` + `opacity-60 text-xs` styling as every other stat card on the dashboard, no new visual pattern introduced.

## Verification
`npm run build` passed cleanly, all 18 routes generated, no errors. Then verified live against Supabase and the running admin dashboard (not just code review):
- Confirmed `is_bot` column and existing data (11091 rows, all `is_bot = false` before this change).
- Logged into `/admin` as admin and confirmed the dashboard rendered three view-count cards, with "real visitors (bot-filtered)" showing the same value as "total page views" (since no bot-tagged rows existed yet).
- Hit the homepage with a Googlebot user-agent: total went 11091 → 11092 (row **was** inserted, unlike the old drop behavior) while `is_bot = false` stayed at 11091, and the newest row was confirmed `is_bot: true`.
- Hit the homepage with a normal Chrome user-agent: total → 11093, `is_bot = false` → 11092 — both counters move together for real traffic.

## Note on existing data
`is_bot` tagging only affects rows recorded **going forward**. Every row already in `page_views` (from before this change, including from before the previous session's drop-based bot filtering existed at all) defaults to `is_bot = false` and is not retroactively reclassified — those older rows are not a reliable signal of real vs. bot traffic, only rows inserted after this change are.

## Bottom line
Bot/crawler/link-preview traffic (and missing UAs) is now tagged (`is_bot = true`) rather than dropped, so raw request volume in `page_views` is preserved while still being filterable. The admin dashboard shows both the unfiltered "total page views" and the new "real visitors (bot-filtered)" count side by side. Desktop keyboard-arrow and click-chevron navigation between clips remains in place (verified already correct from prior work, unchanged here) on both the grid and detail page, and mobile touch/swipe logic in both files was not modified. Build verified green; changes committed and pushed to `main` (commit `41ed8db`).

---

# RECAP 6 — 2026-08-11

## Task
Remove the "click to vote" hover overlay from grid tiles on desktop.

## What was done
Removed the entire conditional overlay block from [components/ClipGrid.jsx](components/ClipGrid.jsx) — the `{hovering && !isExpanded && clip.video_url && (...)}` block rendering a `hover-only` positioned `<span>` reading "click to vote" over a tile on hover. This was a pure deletion: no other hover behavior, styling, or logic in the file (including the `hovering` state itself, which is still used elsewhere in the file) was touched.

## Verification
`npm run build` passed cleanly — all 18 routes generated, no errors.

## Bottom line
The "click to vote" hover badge no longer renders on grid tiles. Nothing else in `ClipGrid.jsx` changed. Build verified green; changes committed and pushed to `main` (commit `213adaf`).

---

# RECAP 7 — 2026-08-11

## Task
Comment out the "Buy me a coffee" Ko-fi link in [components/ClipGrid.jsx](components/ClipGrid.jsx) without deleting it, so it stops rendering but stays in the file.

## What was done
Wrapped the single `<a href="https://ko-fi.com/oldmantriesbjj" ...>Buy me a coffee</a>` line in a JSX comment (`{/* ... */}`). No other lines in the file were touched.

## Verification
`npm run build` passed cleanly — all 18 routes generated, no errors.

## Bottom line
The Ko-fi "Buy me a coffee" link no longer renders but remains in the source, commented out, ready to be restored by removing the `{/* */}` wrapper. Build verified green; changes committed and pushed to `main` (commit `87ff1e4`).

---

# RECAP 8 — 2026-08-11

## Task
In [app/page.js](app/page.js), turn the "oldmantriesbjj.com" text in the handle line into a link to https://jiujitsu.net, opening in a new tab, keeping the rest of the line unchanged.

## What was done
Changed the single `<p>` line so `{copy.handle || "@OldManTriesBJJ"} ·` stays as plain text, followed by "oldmantriesbjj.com" now wrapped in `<a href="https://jiujitsu.net" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-100">`. No other lines in the file were touched.

## Verification
`npm run build` passed cleanly — all 18 routes generated, no errors.

## Bottom line
"oldmantriesbjj.com" in the homepage handle line is now a clickable link that opens https://jiujitsu.net in a new tab; note the link text still reads "oldmantriesbjj.com" while pointing to a different domain, as explicitly specified in the request. Nothing else in `page.js` changed. Build verified green; changes committed and pushed to `main` (commit `9dcfb79`).

---

# RECAP 9 — 2026-08-11

## Task
In [app/page.js](app/page.js), change the link text from "oldmantriesbjj.com" to "jiujitsu.net" so the visible text matches the `https://jiujitsu.net` destination it already links to.

## What was done
Changed only the text node inside the existing `<a href="https://jiujitsu.net" ...>` element, from "oldmantriesbjj.com" to "jiujitsu.net". No other lines in the file were touched.

## Verification
`npm run build` passed cleanly — all 18 routes generated, no errors.

## Bottom line
The homepage handle line's link now reads "jiujitsu.net" and points to `https://jiujitsu.net`, resolving the text/destination mismatch introduced in RECAP 8. Build verified green; changes committed and pushed to `main` (commit `f323e92`).

---

# RECAP 10 — 2026-08-11

## Task
In [components/ClipGrid.jsx](components/ClipGrid.jsx), decouple vote-count display from grid sort order: a vote's count should update immediately, but the grid should only reorder once the user's attention moves to a different clip (a vote or expand/swipe/navigate on that different clip) — not merely from scrolling away or collapsing a tile back to the grid.

## What was done
Added a frozen sort snapshot, `sortVoteCounts` (`useState(initialVoteCounts)`), plus `activeClipIdRef` (`useRef(null)`) tracking which clip the user is currently "on". Added `commitSortIfClipChanged(clipId)`, which — only when `clipId` differs from `activeClipIdRef.current` — copies the current live `voteCounts` into `sortVoteCounts` (finalizing wherever the previously-active clip's score landed) and updates the ref to the new clip.

`commitSortIfClipChanged` is called from two places:
- At the very start of `handleVoteChange(clipId, ...)`, before the count update is applied — so a vote on a new clip commits the previous clip's position first, then the new clip becomes active (frozen in place through its own subsequent vote changes).
- In a new `useEffect` keyed on `expandedId` that calls `commitSortIfClipChanged(expandedId)` only when `expandedId` is non-null — this fires on expand-by-click and on swipe/arrow-key/chevron navigation to a different clip (all of which change `expandedId` to a new id), but not on collapse (`expandedId` going to `null`), so collapsing back to the grid alone never triggers a resort.

The three `useMemo` sort computations — `sortedClips`, `groupedSections`, `featuredSection` — were switched from reading `voteCounts` to reading `sortVoteCounts`, with `sortVoteCounts` replacing `voteCounts` in their dependency arrays. Every other use of `voteCounts` was left untouched: the live count passed as the `counts` prop into each tile (and on into `ClipTile`/`VotePanel`) and `handleVoteChange`'s own count-update logic (`setVoteCounts`) still update instantly on every vote, exactly as before.

## Verification
`npm run build` passed cleanly — all 18 routes generated, no errors.

## Bottom line
Voting on a clip now bumps its displayed count instantly without moving it in the grid; the grid only re-sorts once the user votes on, expands, or swipes/arrow-keys/chevron-navigates to a *different* clip, at which point the previous clip's final tally is committed into sort order. Scrolling away or collapsing a tile back to the grid, on its own, never triggers a reorder. Build verified green; changes committed and pushed to `main` (commit `090ae9a`).
