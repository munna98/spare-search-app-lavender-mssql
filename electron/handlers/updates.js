// electron/handlers/updates.js
import { ipcMain, app } from 'electron';
import updaterManager from '../autoUpdater.js';

export function registerUpdateHandlers() {
  // Check for updates
  ipcMain.handle('updater:check', async () => {
    updaterManager.checkForUpdates();
    return { success: true, message: 'Checking for updates...' };
  });

  // Download update
  ipcMain.handle('updater:download', async () => {
    updaterManager.downloadUpdate();
    return { success: true, message: 'Downloading update...' };
  });

  // Install update
  ipcMain.handle('updater:install', async () => {
    updaterManager.installUpdate();
    return { success: true, message: 'Installing update...' };
  });

  // Get app version
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });
}