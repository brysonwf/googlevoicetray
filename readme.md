# Google Voice System Tray App

A lightweight, portable Windows system tray wrapper for Google Voice built with Electron. The application runs quietly in the Windows Taskbar System Tray, persists your Google authentication session, dynamically updates its tray icon color based on unread messages/voicemails, and allows custom CSS style injection.

---

## Key Features

* **System Tray Integration:** Runs silently near the Windows OS clock. Clicking `X` hides the app window to the system tray instead of exiting.
* **Single Instance Locking:** Prevents multiple copies of the application from running simultaneously.
* **Dynamic Icon Status:** Draws a custom high-DPI circle icon in real-time without external icon file dependencies:
  * **Grey Circle:** Zero unread messages or voicemails.
  * **Bright Green Circle (`#00C853`):** Active unread messages or voicemails.
* **Smart DOM Polling:** Automatically queries Angular Material badge elements on Google Voice every second, explicitly counting `Messages` and `Voicemail` while ignoring `Spam`.
* **Custom CSS Injection:** Easily inject custom styles into Google Voice on startup.
* **Session Persistence:** Saves your Google Voice login session across computer restarts.

---

## Project Structure

```text
google-voice-tray/
├── main.js          # Core Electron main process & tray logic
├── preload.js       # Context bridge for secure IPC communication
├── package.json     # Node project & electron-builder configuration
└── README.md        # Project documentation