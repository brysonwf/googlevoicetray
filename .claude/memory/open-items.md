---
name: open-items
description: Pending, uncommitted or undeployed work in googlevoicetray as of 2026-10-12
metadata:
  type: project
---
State on 2026-10-12:
- No GitHub release with GoogleVoiceTray.exe has been published yet, so the altbryson demo's "Get it on GitHub" links go to the repo page. Once a release exists, point those links (`GVT_REPO` in altbryson's public/index.html) at it.
- 2026-10-21 (c293468, pushed, untested against the real site): `customCSS` in main.js snaps unread conversations to the top of the Voice list (flex column + `order: -1` via `:has()`). The selectors (gv-thread-item / role=listitem|option, `.unread` or an "Unread" aria-label) are a best guess: Claude cannot sign in to Google Voice to see the real markup. If it does nothing, inspect an unread thread in the app's DevTools and fix the selectors. The altbryson demo already lists unread threads first.
