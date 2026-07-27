# RECAP

## Task
Fix mobile autoplay failure for the expanded (unmuted) video in [components/ClipGrid.jsx](components/ClipGrid.jsx) — the `<video autoPlay playsInline loop>` (no `muted`) rendered when `isExpanded && clip.video_url`:
1. Attach a ref to it.
2. On `isExpanded` becoming true, explicitly call `.play()` in a `useEffect` (in addition to the existing `autoPlay` attribute).
3. If the returned promise rejects (blocked unmuted autoplay), fall back to muting the video and calling `.play()` again, plus a `needsUnmuteTap` state flag to show a subtle "tap for sound" indicator.
4. That indicator must be a separate element with its own `onClick`/`onTouchEnd` handlers that `stopPropagation`/`preventDefault` before unmuting, so tapping it doesn't also collapse the tile.
5. Reset `needsUnmuteTap` back to `false` when `isExpanded` becomes false.

Everything else (expand/collapse behavior, hover preview video, rest of file) was to stay unchanged.

## What was done
In `ClipTile` inside [components/ClipGrid.jsx](components/ClipGrid.jsx):
- Added `expandedVideoRef` (`useRef`) and `needsUnmuteTap` (`useState`).
- Attached `ref={expandedVideoRef}` to the expanded/unmuted `<video>` element only — the muted hover-preview `<video>` is untouched.
- Added a `useEffect` keyed on `isExpanded`: when it becomes `false`, resets `needsUnmuteTap` to `false` and returns; when `true`, calls `expandedVideoRef.current.play()` and, if that promise rejects, sets `video.muted = true`, sets `needsUnmuteTap(true)`, and retries `play()`.
- Added `handleUnmuteTap(e)`, which calls `e.stopPropagation()` and `e.preventDefault()` first, then unmutes the video and calls `play()` again, then clears `needsUnmuteTap`.
- Rendered a small "tap for sound" button (speaker icon, bottom-left, shown only when `needsUnmuteTap` is true) with its own `onTouchStart` (stops propagation so it doesn't start the tile's long-press timer), `onTouchEnd`, and `onClick` handlers both wired to `handleUnmuteTap` — so tapping it only unmutes and never triggers the tile's normal tap-to-collapse behavior.

Ran `npm run build` — compiled successfully, all 19 routes generated with no errors.

## Result
Committed as `f6f7d48` ("fix: force-play expanded video and fall back to muted on mobile") and pushed to `origin/main`.
