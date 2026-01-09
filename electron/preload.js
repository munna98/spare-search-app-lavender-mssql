const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Database configuration
  checkConfig: () => ipcRenderer.invoke('config:check'),
  testConnection: (config) => ipcRenderer.invoke('config:test', config),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),
  onConfigStatus: (callback) => ipcRenderer.on('config:status', callback),

  // Stock database configuration
  testStockConnection: (config) => ipcRenderer.invoke('stock:test', config),
  saveStockConfig: (config) => ipcRenderer.invoke('stock:save', config),
  checkStockConfig: () => ipcRenderer.invoke('stock:checkConfig'),

  getStockHistory: (params) => ipcRenderer.invoke('stock:getHistory', params),
  getCustomerLedgers: () => ipcRenderer.invoke('stock:getCustomerLedgers'),
  getCustomerStatement: (params) => ipcRenderer.invoke('stock:getCustomerStatement', params),
  getPendingInvoices: (params) => ipcRenderer.invoke('stock:getPendingInvoices', params),

  // File operations
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  importFile: (filePath) => ipcRenderer.invoke('db:importFile', filePath),

  // Database operations
  searchParts: (searchParams) => ipcRenderer.invoke('db:searchParts', searchParams),
  getUploadedFiles: () => ipcRenderer.invoke('db:getUploadedFiles'),
  removeFile: (fileId) => ipcRenderer.invoke('db:removeFile', fileId),

  // Network operations
  getLocalIPAddresses: () => ipcRenderer.invoke('network:getLocalIPs'),
  getHostname: () => ipcRenderer.invoke('network:getHostname'),

  // Auto Updater
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (event, data) => callback(data));
  },
  removeUpdateListener: () => {
    ipcRenderer.removeAllListeners('update-status');
  },
  getAppVersion: () => ipcRenderer.invoke("get-app-version")
});

