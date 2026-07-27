# RECAP

## Task
In [components/ClipGrid.jsx](components/ClipGrid.jsx), `ClipTile` component: change only the outer container's layout for the existing desktop-hover vote-dot overlay (the block mapping over `GRADE_ORDER` with `gradeColor` and `counts`, gated on `!unrated && !isExpanded`, triggered by `handleEnter`/`handleLeave`) from a horizontal row (`flex items-center justify-center gap-3`) to a vertical stack (`flex flex-col items-center justify-center gap-1`), so the green UP dot+count sits above the red DOWN dot+count. Nothing else about the trigger, fade timing, `!isExpanded` condition, color mapping, or mobile tap behavior was to change.

## What was done
In [components/ClipGrid.jsx](components/ClipGrid.jsx#L734-L747), changed the outer overlay `<div>`'s className from `absolute inset-0 flex items-center justify-center gap-3 transition-opacity duration-300 ...` to `absolute inset-0 flex flex-col items-center justify-center gap-1 transition-opacity duration-300 ...`. Only the flex direction and gap changed (row → column, gap-3 → gap-1); the `absolute inset-0`, fade-opacity transition classes, the `!unrated && !isExpanded` gate, the `GRADE_ORDER`/`gradeColor` mapping, and the inner per-grade `<div>` markup are all untouched.

Ran `npm run build` — compiled successfully, all 19 routes generated with no errors.

## Result
Committed as `a72330a` ("style: stack hover vote-dot indicator vertically instead of side by side") and pushed to `origin/main`.
