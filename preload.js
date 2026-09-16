const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendUnreadCounts: (messagesCount, voicemailCount) => ipcRenderer.send('update-unread-counts', messagesCount, voicemailCount),
  sendChatUnreadCount: (unreadCount) => ipcRenderer.send('update-chat-unread-count', unreadCount)
});

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
