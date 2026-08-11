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
