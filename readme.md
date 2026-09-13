# Google Voice System Tray App

A lightweight, portable Windows system tray wrapper for Google Voice built with Electron. The application runs quietly in the Windows Taskbar System Tray with **dual independent tray icons** — one for Messages and one for Voicemail. Persists your Google authentication session and dynamically updates tray icon colors based on unread messages/voicemails.

---

## Key Features

* **Dual System Tray Icons:** Two separate icons in the Windows System Tray, each with independent functionality:
  * **Messages Icon** — Circle icon showing unread message count
  * **Voicemail Icon** — Upside-down triangle icon showing unread voicemail count
* **Smart Navigation:** Click either icon to open Google Voice and automatically navigate to the corresponding tab (Messages or Voicemail)
* **Dynamic Icon Status:** Real-time icon color updates without external icon file dependencies:
  * **Grey:** Zero unread items
  * **Bright Green (`#00C853`):** Active unread items
* **Single Instance Locking:** Prevents multiple copies of the application from running simultaneously.
* **Smart DOM Polling:** Automatically queries Google Voice UI every second, separately counting `Messages` and `Voicemail` unread items.
* **Session Persistence:** Saves your Google Voice login session across computer restarts.
* **Context Menus:** Right-click either tray icon for quick access to open specific tabs or quit the app.

---

## Tray Icons

### Messages Icon (Circle)
```
  ●       (filled circle when unread)
```
Shows unread message count. Click to open Messages tab.

### Voicemail Icon (Upside-down Triangle)
```
  ▽       (filled triangle when unread)
```
Shows unread voicemail count. Click to open Voicemail tab.

---

## Project Structure

```text
google-voice-tray/
├── main.js          # Core Electron main process & dual tray logic
├── preload.js       # Context bridge for secure IPC communication
├── package.json     # Node project & electron-builder configuration
└── README.md        # Project documentation