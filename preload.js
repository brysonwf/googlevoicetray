const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendUnreadCount: (count) => ipcRenderer.send('update-unread-count', count)
});
