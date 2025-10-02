const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  importFile: (filePath) => ipcRenderer.invoke('db:importFile', filePath),
  searchParts: (searchParams) => ipcRenderer.invoke('db:searchParts', searchParams),
  getUploadedFiles: () => ipcRenderer.invoke('db:getUploadedFiles'),
  removeFile: (fileId) => ipcRenderer.invoke('db:removeFile', fileId)
});