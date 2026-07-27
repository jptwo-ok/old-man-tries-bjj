# RECAP

## Task
In [components/ClipGrid.jsx](components/ClipGrid.jsx), remove the "Standup" link from the "Jump to:" nav row, keeping Guard Pass, Top Game, Bottom Game, Leg Game in the same order. Standup is already the first section on the page, so jumping to it is redundant.

## What was done
Removed the `<a href="#standup">Standup</a>` link from the "Jump to:" nav in [components/ClipGrid.jsx](components/ClipGrid.jsx#L251-L256). The remaining four links (Guard Pass, Top Game, Bottom Game, Leg Game) are unchanged and keep their original order.

Ran `npm run build` — compiled successfully, all 19 routes generated with no errors.

## Result
Committed as `1cdb099` ("fix: remove redundant Standup link from Jump to nav") and pushed to `origin/main`.
