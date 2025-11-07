const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Database configuration
  checkConfig: () => ipcRenderer.invoke('config:check'),
  testConnection: (config) => ipcRenderer.invoke('config:test', config),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),
  onConfigStatus: (callback) => ipcRenderer.on('config:status', callback),
  
  // File operations
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  importFile: (filePath) => ipcRenderer.invoke('db:importFile', filePath),
  
  // Database operations
  searchParts: (searchParams) => ipcRenderer.invoke('db:searchParts', searchParams),
  getUploadedFiles: () => ipcRenderer.invoke('db:getUploadedFiles'),
  removeFile: (fileId) => ipcRenderer.invoke('db:removeFile', fileId),
  
  // Network operations
  getLocalIPAddresses: () => ipcRenderer.invoke('network:getLocalIPs'),
  getHostname: () => ipcRenderer.invoke('network:getHostname')
});