---
name: project
description: What googlevoicetray is, its stack, hosting/deploy and repo location, and how it appears on the altbryson portfolio
metadata:
  type: project
---
Google Voice Tray = Electron system-tray wrapper for Google Voice (Windows mainly; mac/Linux builds are configured). See readme.md for features and build commands.

- Three tray icons drawn in code (no icon files): circle = Messages, upside-down triangle = Voicemail, square = Google Chat. Grey #808080 at 0 unread, green #00C853 when unread. Clicking toggles a fixed 375x667 frameless window bottom-right above the taskbar. Right-click menu: Open…, Auto-open on new messages, show/hide each icon (at least one must stay on), Quit App.
- The Chat window loads chat.google.com with a desktop user agent; Voice uses a narrow iPhone-SE-sized viewport.
- Build: `npm run dist` → dist/GoogleVoiceTray.exe (portable).
- Repo: github.com/brysonwf/googlevoicetray.

Portfolio: Bryson's portfolio desktop at altbryson.com (repo Projects/altbryson) recreates this app. The three tray icons sit in its dock with demo Messages/Voicemail/Chat screens and the same right-click menu, and every screen links to this repo so visitors can download it. If the app's icons, menu or screens change, update that demo too.
