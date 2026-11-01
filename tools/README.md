# tools

| Script | What it does |
|---|---|
| `check-injected.js main.js` | Syntax-checks the poller scripts `main.js` injects into the Voice and Chat pages (`node --check` can't see inside them). |
| `inspect-unread.js [port] [main.js]` | With the app started as `npx electron . --remote-debugging-port=9333`, lists every element on the live Voice/Chat pages whose label mentions "unread". Given `main.js`, it also dry-runs that file's pollers on the live pages and prints what they'd send to the tray, without changing the tray. It reads labels and titles only, not message text. |
| `test-hotkeys-attachments.js [port]` | With the app started as `npx electron . --remote-debugging-port=9333`, checks on the live Voice page that single-key shortcuts are blocked and that clicking a (fake) attachment grows the window and restores it afterwards. Touches no conversations. |
