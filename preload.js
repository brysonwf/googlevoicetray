const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendUnreadCounts: (messagesCount, voicemailCount) => ipcRenderer.send('update-unread-counts', messagesCount, voicemailCount)
});
