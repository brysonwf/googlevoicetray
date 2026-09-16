# Google Voice System Tray App

A lightweight, cross-platform system tray wrapper for Google Voice built with Electron. Available for **Windows**, **macOS**, and **Linux**. The application runs quietly in your system tray with **dual independent tray icons** — one for Messages and one for Voicemail. Persists your Google authentication session and dynamically updates tray icon colors based on unread messages/voicemails.

---

## Key Features

* **Cross-Platform Support:** Works on Windows, macOS, and Linux
* **Dual System Tray Icons:** Two separate icons in your system tray, each with independent functionality:
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
* **iPhone SE Layout:** Opens Google Voice with a 375x667 content viewport so its narrow responsive layout is used without changing browser compatibility.
* **Tray Positioning:** Places the window above the Windows notification area, with a small clearance above the taskbar, on the display containing the tray icon.

The app keeps the native Windows frame. A frameless/custom frame is possible, but it would require a custom draggable title bar and window controls because the Google Voice page cannot provide those controls safely.

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
```

---

## Build & Installation

### Prerequisites
- Node.js v18+ and npm installed
- Run `npm install` to install dependencies

### Build Commands

**Build for current platform:**
```bash
npm run dist
```

**Build for specific platforms:**
```bash
npm run dist:win      # Windows (portable EXE)
npm run dist:mac      # macOS (DMG + ZIP)
npm run dist:linux    # Linux (AppImage + DEB)
```

### Output Files
- **Windows:** `dist/GoogleVoiceTray.exe` (portable executable)
- **macOS:** `dist/GoogleVoiceTray.dmg` and `dist/GoogleVoiceTray.zip`
- **Linux:** `dist/GoogleVoiceTray.AppImage` and `dist/GoogleVoiceTray.deb`

### Running Locally
```bash
npm start
```

### Note on Cross-Platform Building
You can only build for your current OS from Windows. To build for macOS or Linux, run the build commands on those respective operating systems. However, you can commit these updated build configurations so anyone on macOS or Linux can run the builds.