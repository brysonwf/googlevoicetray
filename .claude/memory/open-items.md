---
name: open-items
description: Pending, uncommitted or undeployed work in googlevoicetray as of 2026-10-12
metadata:
  type: project
---
State on 2026-10-12:
- No GitHub release with GoogleVoiceTray.exe has been published yet, so the altbryson demo's "Get it on GitHub" links go to the repo page. Once a release exists, point those links (`GVT_REPO` in altbryson's public/index.html) at it.
- 2026-10-28 (Bryson note): clicking a tray icon should force an immediate check for unread messages so the green dot clears faster. 2026-11-01 (branch `click-refresh-unread`, untested on the real sites): each tray click now runs the page's `window.__gvtCheckUnread()` immediately, and both windows set `backgroundThrottling: false`. That second change is likely the real fix, because Chromium was throttling the 1 s poller while the windows were hidden. The same change wires up `chatUnreadPollerScript`, which had never been injected, so the Chat dot never changed before. Its selector `[aria-label*="unread" i]` is a guess and might match a permanent "Unread" filter, which would leave the Chat dot always green. If so, tighten it in the app's DevTools. Bryson keeps notes in `brysonnotes.txt` files. Leave them in place; never delete them without his yes.
- 2026-10-21 (c293468, pushed, untested against the real site): `customCSS` in main.js snaps unread conversations to the top of the Voice list (flex column + `order: -1` via `:has()`). The selectors (gv-thread-item / role=listitem|option, `.unread` or an "Unread" aria-label) are a best guess: Claude cannot sign in to Google Voice to see the real markup. If it does nothing, inspect an unread thread in the app's DevTools and fix the selectors. The altbryson demo already lists unread threads first.
