const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendUnreadCounts: (messagesCount, voicemailCount) => ipcRenderer.send('update-unread-counts', messagesCount, voicemailCount),
  sendChatUnreadCount: (unreadCount) => ipcRenderer.send('update-chat-unread-count', unreadCount)
});

// Turn off Google Voice's single-key shortcuts (e = archive, # = delete, ...).
// Typing while the message box isn't focused used to archive the thread
// (Bryson 2026-11-01). Preload runs before Voice's scripts, so this capture
// listener fires first. Plain keys typed outside a text field are kept from
// Voice; if a message box is on screen, focus moves there so the typing lands
// in it. Ctrl/Alt/Cmd combos, Enter, Esc, Tab and arrows are untouched.
if (location.hostname === 'voice.google.com') {
  const isEditable = (el) =>
    !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

  const findMessageBox = () =>
    [...document.querySelectorAll('textarea, [contenteditable="true"]')].find(
      (el) => !el.disabled && el.getClientRects().length > 0
    );

  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.length !== 1) return; // only printable keys: letters, digits, symbols, space
    if (isEditable(event.target) || isEditable(document.activeElement)) return;

    event.stopImmediatePropagation();
    const box = findMessageBox();
    if (box) {
      box.focus(); // the key's character is then typed into the box
    } else {
      event.preventDefault(); // nowhere to type: just swallow it
    }
  }, true);
}

const TOP_RESIZE_GRAB_HEIGHT = 8;
let topResizeActive = false;

document.addEventListener('pointermove', (event) => {
  document.documentElement.style.cursor = event.clientY <= TOP_RESIZE_GRAB_HEIGHT ? 'ns-resize' : '';

  if (topResizeActive) {
    ipcRenderer.send('top-resize-move', event.screenY);
  }
});

document.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || event.clientY > TOP_RESIZE_GRAB_HEIGHT) return;

  topResizeActive = true;
  if (event.target.setPointerCapture) event.target.setPointerCapture(event.pointerId);
  ipcRenderer.send('top-resize-start', event.screenY);
  event.preventDefault();
});

document.addEventListener('pointerup', () => {
  if (!topResizeActive) return;

  topResizeActive = false;
  ipcRenderer.send('top-resize-end');
});
