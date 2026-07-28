# RECAP

## Task
Read-only investigation into what's actually driving Supabase egress usage. Four parts: (1) classify every clip's `video_url`/`thumbnail_url` by storage host, (2) get real file sizes for Supabase-hosted thumbnails, (3) confirm whether Next.js Image Optimization (`next/image`) touches these URLs, (4) check for any uncached full image/video fetches on the site or admin dashboard. No code changes requested except this recap.

## Method
Queried the live `clips` table directly via a one-off script (`scripts/egress-investigation.js`), fetching all rows (`id, title, video_url, thumbnail_url`) and classifying each URL's hostname. For every Supabase-hosted thumbnail, issued a HTTPS `HEAD` request (8-way concurrency) to read `content-length` and `cache-control` straight from the origin. Also read the relevant source files (`components/ClipGrid.jsx`, `components/ClipsManager.jsx`, `app/page.js`, `app/clip/[id]/page.js`, `next.config.js`, `app/api/admin/**`) to check for `next/image` usage and uncached fetch patterns. Run at 2026-07-28, ~14:06–14:11 UTC.

## 1 — Host breakdown (546 total clips)

**Thumbnail host:**
| Host | Count |
|---|---|
| Supabase (`zkjpudjvmeqriwmsqnna.supabase.co`) | 545 |
| Cloudflare R2 (`cdn.oldmantriesbjj.com`) | 1 |

**Video host:**
| Host | Count |
|---|---|
| Cloudflare R2 (`cdn.oldmantriesbjj.com`) | 543 |
| Supabase (`zkjpudjvmeqriwmsqnna.supabase.co`) | 3 |

No clips had a null/empty URL or a host other than these two. Both counts sum to 546.

## 2 — Supabase thumbnail sizes (HEAD requests, all 545 succeeded, 200 OK)

- **Total combined size: 48,103,597 bytes (≈ 45.87 MB)**
- **Average size per thumbnail: 88,263 bytes (≈ 86.2 KB)**
- Content-Type on every sampled response: `image/jpeg`
- Cache-Control on every sampled response: **`no-cache`** (present alongside a valid `ETag` + `Last-Modified`, so conditional revalidation is possible, but the response is never servable from cache without a round trip)

For comparison, pulled the same data for other buckets:
- The 1 R2-hosted thumbnail: 65,285 bytes, `Cache-Control: max-age=14400`
- The 3 Supabase-hosted videos (legacy, pre-R2-migration): 19,457,752 bytes total, avg 6,485,917 bytes (≈ 6.19 MB) each
- Sampled R2-hosted videos: 8.4–11.3 MB each, `Cache-Control: max-age=14400`

Source of the thumbnail size: `captureThumbnail()` in [components/ClipsManager.jsx:134-173](components/ClipsManager.jsx#L134-L173) grabs a canvas frame at the source video's **native resolution** (`canvas.width = video.videoWidth`, no downscale) and encodes it as JPEG at quality `0.82` — this is why individual thumbnails run tens to 100+ KB rather than a typical small thumbnail size.

## 3 — next/image usage

- Grep for `next/image` across the entire repo: **0 matches**. No component imports or uses Next's `<Image>` component anywhere.
- The only place a thumbnail is rendered on the site is a plain `<img src={thumb}>` in [components/ClipGrid.jsx:622](components/ClipGrid.jsx#L622).
- `next.config.js` **does** declare `images.remotePatterns` for both `**.supabase.co` and `cdn.oldmantriesbjj.com` — but since no `<Image>` component exists anywhere, this config is currently unused/vestigial. It does not by itself cause any transformation or re-fetching.
- Confirmed: prior scans that found no `next/image` usage still hold.

## 4 — Uncached fetch patterns

- **Public homepage** ([app/page.js](app/page.js)) and **clip detail page** ([app/clip/[id]/page.js](app/clip/[id]/page.js)) both set `export const dynamic = "force-dynamic"`, and `next.config.js` sets `experimental.staleTimes.dynamic = 0`. This means every page request re-runs the server component and re-queries the `clips` table fresh from Supabase — no Next.js data/page caching layer at all. This affects the **database** query path, not storage bytes directly, but it does mean the full clip list (all `thumbnail_url`/`video_url` strings) is re-fetched from Supabase on every single page view with zero caching.
- No cache-busting query parameters (e.g. `?t=<timestamp>`) are appended to any `thumbnail_url` or `video_url` anywhere in the code — URLs are used exactly as stored.
- [components/ClipGrid.jsx](components/ClipGrid.jsx) renders one `<img>` tag per clip tile for the **entire grid** (currently up to 546 tiles) on every homepage load. On top of that, it conditionally mounts a fresh `<video src={clip.video_url} autoPlay>` element on **both** desktop mouse-hover (`hovering && clip.video_url`, line ~612) and mobile tap/long-press-expand (`isExpanded && clip.video_url`, line ~601) — each hover-in/tap-in event mounts a brand-new `<video>` element pointing at the full clip file, with no pooling/reuse of a single player element.
- No server-side route proxies or re-serves image/video bytes. The only API routes under `app/api/admin/*` handle clip CRUD, bulk import, and R2 presigned-upload URL generation — none of them stream file content.
- [components/ClipsManager.jsx](components/ClipsManager.jsx) (the admin clips dashboard) does **not** render any `<img>` or `<video>` preview at all — `video_url`/`thumbnail_url` only ever appear as plain editable text fields. The admin dashboard itself does not load any image or video bytes.
- The Supabase thumbnail response's `Cache-Control: no-cache` (see Part 2) means every browser load of the homepage grid must at minimum revalidate all 545 Supabase-hosted thumbnails with the origin — a `304` is possible if unchanged (cheap), but a fully warm, no-round-trip cache hit is not, unlike the R2 assets which carry `max-age=14400`.

## Bottom line (data only, no interpretation added)
- 545 of 546 clip thumbnails are still served from Supabase Storage; only 3 of 546 videos are. Video hosting has already been migrated to R2 almost entirely; thumbnails have not.
- Combined size of all Supabase-hosted thumbnails right now: **48,103,597 bytes (≈ 45.87 MB)**, averaging **88,263 bytes (≈ 86.2 KB)** each — inflated by capturing thumbnails at native video resolution with no downscaling.
- `next/image` is confirmed unused anywhere in the codebase; the `remotePatterns` config in `next.config.js` is currently inert.
- Supabase-hosted thumbnails are served with `Cache-Control: no-cache`, forcing revalidation on every fetch, versus R2 assets which carry a 4-hour `max-age`.
- Both the homepage and clip detail page are fully `force-dynamic` with no page-level caching, so the full clip list (and therefore all thumbnail/video URLs) is re-queried from Supabase on every single page view.
